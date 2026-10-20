import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { Pool } from "pg";

const cookieName = "desk_session";

export type SessionUser = { id: string; email: string };

export function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email}\n${code}`).digest("hex");
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

export async function requestCode(pool: Pool, email: string, ip: string) {
  const recent = await pool.query(
    `SELECT
       count(*) FILTER (WHERE email=$1) AS for_email,
       count(*) FILTER (WHERE request_ip=$2) AS for_ip
     FROM email_codes WHERE created_at > now() - interval '15 minutes'`,
    [email, ip],
  );
  if (Number(recent.rows[0].for_email) >= 5 || Number(recent.rows[0].for_ip) >= 20) {
    throw new Error("Wait a few minutes before asking for another code.");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await pool.query("UPDATE email_codes SET used_at=now() WHERE email=$1 AND used_at IS NULL", [email]);
  await pool.query(
    `INSERT INTO email_codes(email,code_hash,expires_at,request_ip) VALUES($1,$2,now() + interval '10 minutes',$3)`,
    [email, hashCode(email, code), ip],
  );
  await deliverCode(email, code);
}

export async function verifyCode(pool: Pool, email: string, code: string): Promise<SessionUser & { token: string }> {
  const row = await pool.query(
    `SELECT id,code_hash,expires_at,attempts FROM email_codes
     WHERE email=$1 AND used_at IS NULL ORDER BY id DESC LIMIT 1`,
    [email],
  );
  const pending = row.rows[0];
  if (!pending || new Date(pending.expires_at).getTime() < Date.now() || pending.attempts >= 5) {
    throw new Error("That code is no longer valid. Ask for a new one.");
  }
  const expected = Buffer.from(String(pending.code_hash));
  const actual = Buffer.from(hashCode(email, code.trim()));
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    await pool.query("UPDATE email_codes SET attempts=attempts+1 WHERE id=$1", [pending.id]);
    throw new Error("That code does not match.");
  }
  await pool.query("UPDATE email_codes SET used_at=now() WHERE id=$1", [pending.id]);
  const user = await pool.query(
    `INSERT INTO users(email) VALUES($1) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email`,
    [email],
  );
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now() + interval '14 days')`,
    [user.rows[0].id, hashToken(token)],
  );
  return { id: String(user.rows[0].id), email: String(user.rows[0].email), token };
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
