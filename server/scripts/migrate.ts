import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

// Connect to the local Compose database.
const pool = new Pool({
  connectionString:
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
