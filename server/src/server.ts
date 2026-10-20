import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import express, { type Request, type Response } from "express";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import {
  clearSessionCookie,
  endSession,
  normalizeEmail,
  requestCode,
  sessionCookie,
  userFromRequest,
  verifyCode,
  type SessionUser,
} from "./auth.ts";
import { commitSelectedRows, detectPlatform, previewImport } from "./import-service.ts";
import { complaintSamplesZip } from "./sample-archive.ts";
import { applyPolicyCheck } from "./evaluation.ts";
import { recordDecision, type DecisionKind } from "./decision-service.ts";
import {
  caseEvidence,
  dashboardCases,
  dashboardMetrics,
} from "./dashboard-service.ts";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const app = express();
if (process.env.VERCEL) app.set("trust proxy", 1);

app.use(express.json({ limit: "64kb" }));

function clientMessage(error: unknown, fallback: string) {
  const code = (error as { code?: unknown })?.code;
  const sqlState = typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
  return error instanceof Error && !sqlState ? error.message : fallback;
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://app:local-development-only@localhost:5432/grievances",
});
attachDatabasePool(pool);

app.get("/openapi.yaml", (_req, res) => {
  // Serve the versioned API contract from the repository.
  res.sendFile("docs/openapi.yaml", { root: process.cwd() });
});

async function requireUser(req: Request, res: Response): Promise<SessionUser | null> {
  const user = await userFromRequest(pool, req);
  if (!user) {
    res.status(401).json({
      error: {
        code: "SIGN_IN_REQUIRED",
        message: "Sign in with your email to import or change a case.",
      },
    });
  }
  return user;
}

app.get("/api/auth/session", async (req, res) => {
  const user = await userFromRequest(pool, req);
  res.json({ email: user?.email ?? null });
});

app.post("/api/auth/code", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    await requestCode(pool, email, req.ip ?? "unknown");
    res.status(202).json({ sent: true });
  } catch (error) {
    res.status(400).json({
      error: {
        code: "CODE_NOT_SENT",
        message: clientMessage(error, "The code could not be sent."),
      },
    });
  }
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const session = await verifyCode(pool, email, String(req.body.code ?? ""));
    res.setHeader("set-cookie", sessionCookie(session.token));
    res.json({ email: session.email });
  } catch (error) {
    res.status(400).json({
      error: {
        code: "CODE_REJECTED",
        message: clientMessage(error, "That code does not match."),
      },
    });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  await endSession(pool, req);
  res.setHeader("set-cookie", clearSessionCookie());
  res.status(204).end();
});

app.get("/api/dashboard", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const viewer = await userFromRequest(pool, req);
  const [metrics, cases] = await Promise.all([
    dashboardMetrics(pool, viewer?.id ?? null),
    dashboardCases(pool, {
      bucket: req.query.bucket ? String(req.query.bucket) : undefined,
      departmentId: req.query.departmentId
        ? String(req.query.departmentId)
        : undefined,
      page,
      pageSize,
      viewerId: viewer?.id ?? null,
    }),
  ]);
  res.json({ metrics, cases });
});
app.get("/api/cases/:id/evidence", async (req, res) => {
  const viewer = await userFromRequest(pool, req);
  const evidence = await caseEvidence(pool, req.params.id, viewer?.id ?? null);
  if (!evidence) {
    res
      .status(404)
      .json({ error: { code: "CASE_NOT_FOUND", message: "Case not found" } });
    return;
  }
  res.json(evidence);
});

app.post("/api/evaluations/:id/decisions", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
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
    const owner = await client.query(
      `SELECT c.owner_user_id FROM evaluations e JOIN cases c ON c.id=e.case_id WHERE e.id=$1`,
      [req.params.id],
    );
    const decisionOwner = owner.rows[0]?.owner_user_id;
    if (!owner.rows[0] || String(decisionOwner ?? "") !== user.id) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: {
          code: "READ_ONLY",
          message: owner.rows[0]
            ? "This case belongs to another visitor."
            : "That decision could not be recorded.",
        },
      });
      return;
    }
    const result = await recordDecision(client, {
      evaluationId: req.params.id,
      decision,
      reason: req.body.reason,
      actorId: user.email,
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
        message: clientMessage(error, "Decision failed"),
      },
    });
  } finally {
    client.release();
  }
});

app.post("/api/cases/:id/evaluations", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const caseResult = await client.query(
      "SELECT id, owner_user_id FROM cases WHERE id=$1 FOR UPDATE",
      [req.params.id],
    );
    const evaluationOwner = caseResult.rows[0]?.owner_user_id;
    if (caseResult.rows[0] && String(evaluationOwner ?? "") !== user.id) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: {
          code: "READ_ONLY",
          message: "This case belongs to another visitor.",
        },
      });
      return;
    }
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
        message: clientMessage(error, "Evaluation failed"),
      },
    });
  } finally {
    client.release();
  }
});

app.get("/api/samples/complaint-samples.zip", async (_req, res) => {
  res
    .type("application/zip")
    .attachment("complaint-samples.zip")
    .send(await complaintSamplesZip());
});

app.post(
  "/api/imports/preview",
  express.text({ type: "text/csv", limit: "512kb" }),
  async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const csv = String(req.body);
      const platform = detectPlatform(csv);
      const result = await previewImport(
        pool,
        platform,
        String(req.headers["x-source-name"] ?? "upload.csv"),
        csv,
        user.email,
        user.id,
      );
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        error: {
          code: "IMPORT_PREVIEW_FAILED",
          message: clientMessage(error, "Preview failed"),
        },
      });
    }
  },
);

app.post("/api/imports/:batchId/commit", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const actorId = user.email;
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
    const batch = await client.query(
      "SELECT owner_user_id FROM import_batches WHERE id=$1",
      [req.params.batchId],
    );
    if (!batch.rows[0] || String(batch.rows[0].owner_user_id ?? "") !== user.id) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: {
          code: "READ_ONLY",
          message: "This import belongs to another visitor.",
        },
      });
      return;
    }
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
        message: clientMessage(error, "Commit failed"),
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

const publicRoot = resolve("public");

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const relative = req.path === "/" ? "index.html" : req.path.replace(/^\/+/, "");
  const file = resolve(publicRoot, relative);
  if (file !== publicRoot && !file.startsWith(publicRoot + sep)) return next();
  const isFile = (path: string) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  };
  if (isFile(file)) {
    res.sendFile(file);
    return;
  }
  const index = resolve(publicRoot, "index.html");
  if (!relative.includes(".") && isFile(index)) {
    res.sendFile(index);
    return;
  }
  next();
});

export default app;

if (!process.env.VERCEL) {
  app.listen(3000, () => console.log("API listening at http://localhost:3000"));
}
