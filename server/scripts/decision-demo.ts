import { Pool } from "pg";

// Reject the newest undecided evaluation without changing its recommendation.
const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});
const latest = await pool.query(
  `SELECT e.id,e.recommendation_outcome FROM evaluations e LEFT JOIN review_decisions d ON d.evaluation_id=e.id WHERE d.id IS NULL ORDER BY e.id DESC LIMIT 1`,
);
if (!latest.rows[0])
  throw new Error("Create an evaluation before running this demo");
const response = await fetch(
  `http://localhost:3000/api/evaluations/${latest.rows[0].id}/decisions`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      decision: "REJECTED",
      reason:
        "The escalation is not proportionate after reviewing the source evidence.",
      actorId: "supervisor-demo",
    }),
  },
);
console.log(
  "recommendation before review:",
  latest.rows[0].recommendation_outcome,
);
console.log("decision response:", await response.json());
await pool.end();
