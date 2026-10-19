import express from "express";
import { Pool } from "pg";
import { previewImport, type Platform } from "./import-service.ts";

const app = express();

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});

app.post(
  "/api/imports/preview",
  express.text({ type: "text/csv", limit: "512kb" }),
  async (req, res) => {
    try {
      const platform = String(
        req.headers["x-source-platform"] ?? "",
      ) as Platform;
      if (
        !["whatsapp", "website", "facebook", "spreadsheet"].includes(platform)
      ) {
        res.status(400).json({
          error: {
            code: "INVALID_PLATFORM",
            message: "x-source-platform is required",
          },
        });
        return;
      }
      const result = await previewImport(
        pool,
        platform,
        String(req.headers["x-source-name"] ?? "upload.csv"),
        String(req.body),
        String(req.headers["x-actor-id"] ?? "import-reviewer"),
      );
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        error: {
          code: "IMPORT_PREVIEW_FAILED",
          message: error instanceof Error ? error.message : "Preview failed",
        },
      });
    }
  },
);

app.use(express.json({ limit: "64kb" }));

app.post("/api/imports/:batchId/commit", async (req, res) => {
  const actorId = String(req.body.actorId ?? "import-reviewer");
  const rowIds = Array.isArray(req.body.rowIds)
    ? req.body.rowIds.map(String)
    : [];
  const confirmedRowIds = new Set(
    Array.isArray(req.body.confirmedRowIds)
      ? req.body.confirmedRowIds.map(String)
      : [],
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await client.query(
      "SELECT * FROM import_rows WHERE batch_id=$1 AND id=ANY($2::bigint[]) FOR UPDATE",
      [req.params.batchId, rowIds],
    );
    const committed: string[] = [];
    for (const row of rows.rows) {
      const allowed =
        row.outcome === "VALID" || confirmedRowIds.has(String(row.id));
      if (
        !allowed ||
        ["REJECTED", "ALREADY_IMPORTED", "SOURCE_CHANGE_REVIEW"].includes(
          row.outcome,
        )
      )
        continue;
      committed.push(await insertCaseAndAudit(client, row, actorId));
    }
    await client.query(
      "UPDATE import_batches SET status='COMMITTED' WHERE id=$1",
      [req.params.batchId],
    );
    await client.query("COMMIT");
    res.status(201).json({
      batchId: req.params.batchId,
      committedCaseIds: committed,
      requested: rowIds.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(409).json({
      error: {
        code: "IMPORT_COMMIT_FAILED",
        message: error instanceof Error ? error.message : "Commit failed",
      },
    });
  } finally {
    client.release();
  }
});

async function insertCaseAndAudit(
  client: any,
  row: any,
  actorId: string,
): Promise<string> {
  const value = row.proposed_values;
  const createdAt = new Date().toISOString();
  const inserted = await client.query(
    `INSERT INTO cases(source_platform,source_record_id,source_url,import_batch_id,import_row_id,original_values,title,description,received_date,normalized_status,created_at) SELECT b.source_platform,$1,$2,b.id,$3,$4,$5,$6,$7,$8,$9 FROM import_batches b WHERE b.id=$10 ON CONFLICT(source_platform,source_record_id) DO NOTHING RETURNING id`,
    [
      row.source_record_id,
      row.source_url,
      row.id,
      row.original_values,
      value.title,
      value.description,
      value.receivedDate,
      value.normalizedStatus ?? "NEEDS_CLARIFICATION",
      createdAt,
      row.batch_id,
    ],
  );
  if (!inserted.rows[0])
    throw new Error("Source record already exists; review required");
  const caseId = String(inserted.rows[0].id);
  await client.query(
    `INSERT INTO audit_events(entity_type,entity_id,event_type,actor_id,event_time,before_values,after_values,metadata) VALUES('case',$1,'CASE_IMPORTED',$2,$3,NULL,$4,$5)`,
    [
      caseId,
      actorId,
      createdAt,
      { caseId, sourceRecordId: row.source_record_id },
      { batchId: String(row.batch_id), importRowId: String(row.id) },
    ],
  );
  return caseId;
}

app.get("/api/health", async (_req, res) =>
  res.json({
    status: "ok",
    database: (await pool.query("SELECT 1")).rowCount === 1,
  }),
);

app.listen(3000, () => console.log("API listening at http://localhost:3000"));
