import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    "postgres://app:local-development-only@localhost:5432/grievances",
});

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

const files = (await readdir("server/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const filename of files) {
  const applied = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE filename=$1",
    [filename],
  );
  if (applied.rowCount) continue;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(await readFile(`server/migrations/${filename}`, "utf8"));
    await client.query("INSERT INTO schema_migrations(filename) VALUES($1)", [
      filename,
    ]);
    await client.query("COMMIT");
    console.log(`applied ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
