# Civic Grievance Escalation Console

Imports fictional civic complaints from WhatsApp, website, Facebook, and spreadsheet CSV exports. Each file is staged for review, then selected rows are committed to PostgreSQL as cases. A deadline calculator counts working days in Asia/Kathmandu and skips public holidays.

The running app is an Express API. Node executes the TypeScript sources directly.

## Requirements

- Node.js 24.22 or newer
- Docker, for the local PostgreSQL service in `compose.yaml`

## Setup

```bash
git clone https://github.com/Abhishek-programs/grievance-escalation-console.git
cd grievance-escalation-console
npm install
docker compose up -d
npm run migrate
```

The database is `grievances` on `localhost:5432`, user `app`, password `local-development-only`. Migrations in `server/migrations/` run in filename order and are recorded in `schema_migrations`.

## Run

```bash
npm run dev:server
```

The API listens at `http://localhost:3000`.

`GET /api/health` returns `{ "status": "ok", "database": true }` when Postgres answers.

## Import a CSV

`POST /api/imports/preview` accepts `text/csv` (max 512kb).

| Header | Meaning |
| --- | --- |
| `x-source-platform` | `whatsapp`, `website`, `facebook`, or `spreadsheet` |
| `x-source-name` | File name stored on the batch |
| `x-actor-id` | Reviewer id, default `import-reviewer` |

```bash
curl -s -X POST http://localhost:3000/api/imports/preview \
  -H 'content-type: text/csv' \
  -H 'x-source-platform: whatsapp' \
  -H 'x-source-name: whatsapp-sample.csv' \
  -H 'x-actor-id: demo-reviewer' \
  --data-binary @data/exports/whatsapp-sample.csv
```

A new file is stored as an `import_batches` row in `PREVIEW`, with one `import_rows` row per CSV line. The response groups those rows into `valid`, `rejected`, `warnings`, `possibleDuplicates`, `uncertainMappings`, `alreadyImported`, and `changedSourceRecords`. The same file bytes return `repeatedBatchId` instead of creating another batch.

Recognized statuses are `open`, `resolved`, and `in progress`. Dates must be `2026-MM-DD`, `DD/10/2026`, or `D Oct 2026`. A missing title is rejected. A missing date or unknown status is kept for review.

`POST /api/imports/:batchId/commit` takes JSON:

```json
{ "actorId": "demo-reviewer", "rowIds": ["1"], "confirmedRowIds": [] }
```

`rowIds` are the staged row ids to consider. A row is written when its outcome is `VALID`, or when its id is listed in `confirmedRowIds`. Rows marked `REJECTED`, `ALREADY_IMPORTED`, or `SOURCE_CHANGE_REVIEW` are skipped. The insert and the `CASE_IMPORTED` audit event share one transaction. The response lists `committedCaseIds`.

Generate a larger fictional set (50 rows per platform) and preview the website file:

```bash
npm run generate:data
node server/src/preview-demo.ts
```

Generated files land in `data/exports/` and are gitignored, except `whatsapp-sample.csv`.

## Deadlines

`server/src/policy.ts` walks forward from the received date and counts working days. Public holidays and non-working weekdays are recorded in the trace and do not count. A missing or malformed date returns `NEEDS_CLARIFICATION`. With `DUE_THROUGH_END_OF_DAY`, the case becomes overdue on the day after the deadline.

Migration `003_policy.sql` seeds policy `NP-GRIEVANCE-2026-V1`: Monday–Friday, five working days, and selected Dashain and Tihar dates in 2026. Wiring that stored policy into case deadlines is still ahead of the API.

```bash
npm test
```

## Layout

```text
compose.yaml                 local Postgres
server/src/server.ts         HTTP API
server/src/import-service.ts CSV mapping, staging, review groups
server/src/policy.ts         working-day deadlines
server/src/migrate.ts        apply SQL migrations
server/src/generate-data.ts  reproducible sample exports
server/migrations/           schema
server/tests/policy.test.ts
data/exports/whatsapp-sample.csv
```
