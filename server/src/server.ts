import express from "express";
import { Pool } from "pg";
import { resolve } from "node:path";
import { commitSelectedRows, detectPlatform, previewImport } from "./import-service.ts";
import { applyPolicyCheck } from "./evaluation.ts";
import { recordDecision, type DecisionKind } from "./decision-service.ts";
import {
  caseEvidence,
  dashboardCases,
  dashboardMetrics,
} from "./dashboard-service.ts";

const app = express();

app.use(express.json({ limit: "64kb" }));

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});

app.get("/openapi.yaml", (_req, res) => {
  // Serve the versioned API contract from the repository.
  res.sendFile("docs/openapi.yaml", { root: process.cwd() });
});

app.get("/api/dashboard", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const [metrics, cases] = await Promise.all([
    dashboardMetrics(pool),
    dashboardCases(pool, {
      bucket: req.query.bucket ? String(req.query.bucket) : undefined,
      departmentId: req.query.departmentId
        ? String(req.query.departmentId)
        : undefined,
      page,
      pageSize,
    }),
  ]);
  res.json({ metrics, cases });
});
app.get("/api/cases/:id/evidence", async (req, res) => {
  const evidence = await caseEvidence(pool, req.params.id);
  if (!evidence) {
    res
      .status(404)
      .json({ error: { code: "CASE_NOT_FOUND", message: "Case not found" } });
    return;
  }
  res.json(evidence);
});

app.post("/api/evaluations/:id/decisions", async (req, res) => {
  const allowed: DecisionKind[] = [
    "APPROVED",
    "REJECTED",
    "REASSIGNED",
    "CLARIFICATION_REQUESTED",
  ];
  const decision = String(req.body.decision ?? "") as DecisionKind;
  if (!allowed.includes(decision)) {
    res.status(400).json({
      error: {
        code: "INVALID_DECISION",
        message: "Choose a supported supervisor decision",
      },
    });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await recordDecision(client, {
      evaluationId: req.params.id,
      decision,
      reason: req.body.reason,
      actorId: String(req.body.actorId ?? "supervisor-1"),
      ownerDepartmentId: req.body.ownerDepartmentId
        ? String(req.body.ownerDepartmentId)
        : undefined,
      ownerEmployeeId: req.body.ownerEmployeeId
        ? String(req.body.ownerEmployeeId)
        : null,
    });
    await client.query("COMMIT");
    res.status(201).json(result);
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(409).json({
      error: {
        code: "DECISION_FAILED",
        message: error instanceof Error ? error.message : "Decision failed",
      },
    });
  } finally {
    client.release();
  }
});

app.post("/api/cases/:id/evaluations", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const caseResult = await client.query(
      "SELECT id FROM cases WHERE id=$1 FOR UPDATE",
      [req.params.id],
    );
    if (!caseResult.rows[0]) {
      await client.query("ROLLBACK");
      res
        .status(404)
        .json({ error: { code: "CASE_NOT_FOUND", message: "Case not found" } });
      return;
    }
    const evaluationId = await applyPolicyCheck(client, String(req.params.id));
    await client.query("COMMIT");
    res.status(201).json({ evaluationId });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({
      error: {
        code: "EVALUATION_FAILED",
        message: error instanceof Error ? error.message : "Evaluation failed",
      },
    });
  } finally {
    client.release();
  }
});

app.get("/api/samples/whatsapp.csv", (_req, res) => {
  res.download(resolve("data/exports/whatsapp-sample.csv"), "whatsapp-sample.csv");
});

app.post(
  "/api/imports/preview",
  express.text({ type: "text/csv", limit: "512kb" }),
  async (req, res) => {
    try {
      const csv = String(req.body);
      const platform = detectPlatform(csv);
      const result = await previewImport(
        pool,
        platform,
        String(req.headers["x-source-name"] ?? "upload.csv"),
        csv,
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

app.post("/api/imports/:batchId/commit", async (req, res) => {
  const actorId = String(req.body.actorId ?? "import-reviewer");
  const rowIds = Array.isArray(req.body.rowIds)
    ? req.body.rowIds.map(String)
    : [];
  const confirmedRowIds = new Set<string>(
    Array.isArray(req.body.confirmedRowIds)
      ? req.body.confirmedRowIds.map(String)
      : [],
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await commitSelectedRows(
      client,
      String(req.params.batchId),
      rowIds,
      confirmedRowIds,
      actorId,
    );
    await client.query("COMMIT");
    res.status(201).json({ batchId: req.params.batchId, ...result });
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

app.get("/api/health", async (_req, res) =>
  res.json({
    status: "ok",
    database: (await pool.query("SELECT 1")).rowCount === 1,
  }),
);

app.listen(3000, () => console.log("API listening at http://localhost:3000"));
