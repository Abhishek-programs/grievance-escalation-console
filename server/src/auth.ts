import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { Pool, PoolClient } from "pg";

const cookieName = "desk_session";

export type SessionUser = { id: string; email: string };

function codePepper() {
  const pepper = process.env.CODE_PEPPER;
  if (pepper) return pepper;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email delivery is not configured.");
  }
  return "local-development-only";
}

export function hashCode(email: string, code: string) {
  // A 6-digit code hashed with plain SHA-256 can be reversed from a database copy.
  return createHmac("sha256", codePepper()).update(`${email}\n${code}`).digest("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readCookie(header: string | undefined, name = cookieName) {
  const found = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 14}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

async function deliverCode(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured.");
    }
    console.log(`Sign-in code for ${email}: ${code}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your grievance desk code",
      text: `Your sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) throw new Error("The code could not be sent.");
}

async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function requestCode(pool: Pool, email: string, ip: string) {
  const code = await withTransaction(pool, async (client) => {
    // Lock in key order so two sign-in requests cannot deadlock or both pass the cap.
    await client.query(
      `SELECT pg_advisory_xact_lock(k) FROM (
         SELECT hashtext(v)::bigint AS k FROM (VALUES ($1), ($2)) AS t(v)
       ) keys ORDER BY k`,
      [email, `ip:${ip}`],
    );
    const recent = await client.query(
      `SELECT
         count(*) FILTER (WHERE email=$1) AS for_email,
         count(*) FILTER (WHERE request_ip=$2) AS for_ip
       FROM email_codes WHERE created_at > now() - interval '15 minutes'`,
      [email, ip],
    );
    if (Number(recent.rows[0].for_email) >= 5 || Number(recent.rows[0].for_ip) >= 20) {
      throw new Error("Wait a few minutes before asking for another code.");
    }
    const next = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await client.query("UPDATE email_codes SET used_at=now() WHERE email=$1 AND used_at IS NULL", [email]);
    await client.query(
      `INSERT INTO email_codes(email,code_hash,expires_at,request_ip) VALUES($1,$2,now() + interval '10 minutes',$3)`,
      [email, hashCode(email, next), ip],
    );
    return next;
  });
  await deliverCode(email, code);
}

export async function verifyCode(pool: Pool, email: string, code: string): Promise<SessionUser & { token: string }> {
  const outcome = await withTransaction(pool, async (client) => {
    const row = await client.query(
      `SELECT id,code_hash,expires_at,attempts FROM email_codes
       WHERE email=$1 AND used_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [email],
    );
    const pending = row.rows[0];
    if (!pending || new Date(pending.expires_at).getTime() < Date.now() || pending.attempts >= 5) {
      return { ok: false as const, message: "That code is no longer valid. Ask for a new one." };
    }
    const expected = Buffer.from(String(pending.code_hash));
    const actual = Buffer.from(hashCode(email, code.trim()));
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!matches) {
      await client.query("UPDATE email_codes SET attempts=attempts+1 WHERE id=$1 AND attempts<5", [pending.id]);
      return { ok: false as const, message: "That code does not match." };
    }
    await client.query("UPDATE email_codes SET used_at=now() WHERE id=$1", [pending.id]);
    const user = await client.query(
      `INSERT INTO users(email) VALUES($1) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email`,
      [email],
    );
    const token = randomBytes(32).toString("base64url");
    await client.query(
      `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now() + interval '14 days')`,
      [user.rows[0].id, hashToken(token)],
    );
    return {
      ok: true as const,
      id: String(user.rows[0].id),
      email: String(user.rows[0].email),
      token,
    };
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return { id: outcome.id, email: outcome.email, token: outcome.token };
}

export async function userFromRequest(pool: Pool, req: Request): Promise<SessionUser | null> {
  const token = readCookie(req.headers.cookie);
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const user = result.rows[0];
  return user ? { id: String(user.id), email: String(user.email) } : null;
}

export async function endSession(pool: Pool, req: Request) {
  const token = readCookie(req.headers.cookie);
  if (!token) return;
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
}
