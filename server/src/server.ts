import express from "express";
import { Pool } from "pg";
import { commitSelectedRows, previewImport, type Platform } from "./import-service.ts";
import { findDirectory, recommend } from "./recommendation.ts";
import type { PolicySnapshot } from "./policy.ts";
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

async function loadPolicy(client: any): Promise<PolicySnapshot> {
  // Load one complete snapshot for the evaluation transaction.
  const result = await client.query(
    `SELECT p.*,COALESCE(json_agg(json_build_object('date',h.holiday_date::text,'name',h.name,'sourceUrl',h.source_url)) FILTER (WHERE h.id IS NOT NULL),'[]') AS holidays FROM policy_configs p LEFT JOIN calendar_holidays h ON h.policy_id=p.id GROUP BY p.id ORDER BY p.effective_from DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("No policy configuration found");
  return {
    policyVersion: row.policy_version,
    timezone: row.timezone,
    workingIsoDays: row.working_iso_days,
    holidays: row.holidays,
    allowedWorkingDays: row.allowed_working_days,
    deadlineInclusivity: row.deadline_inclusivity,
    missingDateBehavior: row.missing_date_behavior,
  };
}

async function insertEvaluation(client: any, result: any): Promise<string> {
  const evaluatedAt = new Date().toISOString();
  const policyRow = await client.query(
    "SELECT id FROM policy_configs WHERE policy_version=$1",
    [result.inputFacts.policy.policyVersion],
  );
  const inserted = await client.query(
    `INSERT INTO evaluations(case_id,policy_id,policy_version,evaluated_at,rule_id,input_facts,deadline_calculation,calculated_deadline,recommendation_outcome,recommended_next_step,recommendation_reason,recommended_department_id,suggested_employee_id,next_follow_up_deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      result.inputFacts.caseId,
      policyRow.rows[0].id,
      result.inputFacts.policy.policyVersion,
      evaluatedAt,
      result.ruleId,
      result.inputFacts,
      result.deadlineCalculation,
      result.calculatedDeadline,
      result.outcome,
      result.nextStep,
      result.reason,
      result.departmentId,
      result.suggestedEmployeeId,
      result.nextFollowUpDeadline,
    ],
  );
  const evaluationId = String(inserted.rows[0].id);
  await client.query(
    `INSERT INTO audit_events(entity_type,entity_id,event_type,actor_id,event_time,before_values,after_values,metadata) VALUES('case',$1,'POLICY_EVALUATED','policy-engine',$2,NULL,$3,$4)`,
    [
      result.inputFacts.caseId,
      evaluatedAt,
      { evaluationId, recommendation: result.outcome },
      {
        ruleId: result.ruleId,
        policyVersion: result.inputFacts.policy.policyVersion,
      },
    ],
  );
  return evaluationId;
}

app.post("/api/cases/:id/evaluations", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const caseResult = await client.query(
      "SELECT id,title,description,received_date::text,normalized_status FROM cases WHERE id=$1 FOR UPDATE",
      [req.params.id],
    );
    if (!caseResult.rows[0]) {
      await client.query("ROLLBACK");
      res
        .status(404)
        .json({ error: { code: "CASE_NOT_FOUND", message: "Case not found" } });
      return;
    }
    const policy = await loadPolicy(client);
    const row = caseResult.rows[0];
    const facts = {
      caseId: String(row.id),
      title: row.title,
      description: row.description,
      receivedDate: row.received_date,
      normalizedStatus: row.normalized_status,
      asOfDate: "2026-10-23",
    };
    const candidate = await findDirectory(client, row.title, row.description);
    const result = recommend(facts, policy, candidate);
    const evaluationId = await insertEvaluation(client, result);
    if (result.departmentId) {
      await client.query(
        "UPDATE cases SET department_id=COALESCE(department_id,$1) WHERE id=$2",
        [result.departmentId, row.id],
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ evaluationId, ...result });
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
