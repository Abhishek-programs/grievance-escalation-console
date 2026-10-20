import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { hashCode, verifyCode } from "../src/auth.ts";

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});

test("a sign-in code verifies once", async () => {
  const email = `code-${Date.now()}@example.invalid`;
  const code = "123456";
  await pool.query(
    "INSERT INTO email_codes(email,code_hash,expires_at) VALUES($1,$2,now() + interval '10 minutes')",
    [email, hashCode(email, code)],
  );
  const session = await verifyCode(pool, email, code);
  assert.equal(session.email, email);
  await assert.rejects(() => verifyCode(pool, email, code), /no longer valid/);
});

test("five misses retire the code", async () => {
  const email = `miss-${Date.now()}@example.invalid`;
  const code = "654321";
  await pool.query(
    "INSERT INTO email_codes(email,code_hash,expires_at) VALUES($1,$2,now() + interval '10 minutes')",
    [email, hashCode(email, code)],
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(() => verifyCode(pool, email, "000000"), /does not match/);
  }
  await assert.rejects(() => verifyCode(pool, email, code), /no longer valid/);
});

test.after(async () => pool.end());