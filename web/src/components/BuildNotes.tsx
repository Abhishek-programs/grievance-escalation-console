import { Link, useParams } from "react-router";
import { ThemeToggle } from "./ThemeToggle.tsx";

export const buildNotes = [
  {
    path: "/how-it-is-built/backend",
    kicker: "Backend",
    title: "How the API is put together",
    description:
      "One Express process, the transactions it owns, and the session check in front of every write.",
    lede: "The backend is one TypeScript program. Locally Node runs it. In production Vercel runs the same module as a single function.",
    sections: [
      {
        heading: "One process, two ways of starting it",
        body: [
          "server/src/server.ts builds the Express app, opens the Postgres pool, and registers every route. At the bottom it listens on port 3000 only when the VERCEL environment variable is absent. npm run dev:server is node --watch on that file, so a change to a transaction is the process that is already running.",
          "Vercel looks for an Express app at a fixed set of filenames. The real file lives under server/src, so the repository root has a four-line server.ts that imports Express and re-exports the app. That is the file the platform detects. The function does not call listen. Vercel invokes the exported app for each request and keeps the instance warm under Fluid compute.",
          "There is no second API, no queue worker, and no ORM. Import, policy, decisions, and the dashboard are modules next to the route. Each one takes a pg Pool or a PoolClient and runs SQL. I wanted a reviewer to be able to see the unique key, the row lock, and the savepoint without opening a generated query.",
        ],
      },
      {
        heading: "What a request is allowed to touch",
        body: [
          "Public routes are the health check, the sample zip, and asking for a sign-in code. Everything that reads or writes a complaint goes through the session. userFromRequest hashes the desk_session cookie and loads the user only when sessions.token_hash matches and expires_at is still in the future. The raw token is never stored.",
          "The queue query is owner_user_id equal to that user id. With no session the predicate is FALSE, so the counts and the table are empty rather than the shared directory. Opening a case repeats the same predicate in the WHERE clause before any evaluation, decision, follow-up, or audit row is loaded. A policy check and a supervisor decision start a transaction, lock the case or the evaluation, and refuse the write unless the owner is the session. An import commit does the same on import_batches.",
          "Another address therefore gets an empty desk and a not-found. Guessing a numeric id does not reveal that the row exists. The directory of departments and staff is not tenant data. It is the fictional office the recommendation is allowed to name.",
        ],
      },
      {
        heading: "Where the transactions actually begin",
        body: [
          "Preview is its own short transaction. It inserts the batch and one import_rows line per CSV record, then commits. The route that commits selected rows begins a transaction first and passes that client in. Each case insert runs inside SAVEPOINT row_commit. A unique violation rolls back only the savepoint. The surrounding transaction still commits the rows that succeeded, and the batch stays PREVIEW while any committable row is waiting.",
          "A policy check and a decision are the other multi-statement writes. The route begins, locks with FOR UPDATE, and the service inserts the evaluation or the decision, the follow-up, the case update, and the audit event on that same client. If the follow-up cannot be written, the route rolls the whole transaction back. Reject writes the decision and the audit row and deliberately does not open a follow-up.",
          "Sign-in uses the same shape for a different reason. Asking for a code takes two advisory locks, in key order, then counts recent codes for that email and that IP inside the transaction. Guessing a code locks the email_codes row with FOR UPDATE. Parallel requests cannot both pass the cap, and a failed guess cannot be rolled back out of the attempt counter because the transaction commits the increment.",
        ],
      },
      {
        heading: "The pool, the static files, and the errors",
        body: [
          "The pool reads DATABASE_URL. When that variable is absent, local development uses the Compose database on localhost. attachDatabasePool registers the pool with Vercel so a frozen function does not leak connections. Migrations do not use this pool. They use the direct, unpooled URL, because the pooler is PgBouncer in transaction mode and will not keep a multi-statement migration honest.",
          "Vite writes the desk into public/. On Vercel, express.static is ignored, and the platform was not picking up a folder that only exists after the build. The function therefore includes public/** and serves those files itself. A path with no file extension, including this note, receives index.html. API routes are registered first, so /api is never treated as a page.",
          "A domain error, such as a missing reason, is returned as its message. A Postgres error carries a five-character SQLSTATE. Those are replaced with a fixed sentence so a unique-violation detail does not reach the browser.",
        ],
      },
    ],
  },
  {
    path: "/how-it-is-built/database",
    kicker: "Database",
    title: "How the database is set up",
    description:
      "Postgres 18 locally in Docker, Neon in Singapore in production, and why migrations use a different connection.",
    lede: "There is one database. Locally it is Postgres in Docker. In production it is Neon in Singapore. The schema is the same ordered list of SQL files either way.",
    sections: [
      {
        heading: "The local database",
        body: [
          "compose.yaml runs postgres:18 with database grievances, user app, and password local-development-only, published on port 5432. The volume keeps the data across restarts. npm run dev:server and the tests both open that URL when DATABASE_URL is not set. The tests that import files truncate the case tables first and leave the departments, the staff, and the policy in place.",
          "npm run migrate reads server/migrations in filename order. It creates schema_migrations if needed and skips any file already recorded there. Each file runs in one transaction with its own insert into schema_migrations, so a failed file does not leave a half-applied version number. I apply them from the machine that has the repository. Nothing in the Vercel build runs them.",
        ],
      },
      {
        heading: "What production actually is",
        body: [
          "The hosted database is a Neon project named grievance-desk, Postgres 18, in aws-ap-southeast-1. The branch the app uses is production. Neon is ordinary Postgres with the storage separated from the compute. The compute suspends after it has been idle, which is why the first request after a quiet period pays a wake-up. The queries themselves are the same SQL the local database runs.",
          "Neon gives two connection strings. DATABASE_URL goes through the pooler. The hostname contains -pooler. The API uses that one, because a serverless function must not open an unbounded number of direct sessions. DATABASE_URL_UNPOOLED is the direct host. migrate prefers it. A pooled connection in transaction mode will drop session state between statements, and a migration file is more than one statement. Using the pooler there fails in ways that do not mention the pooler.",
          "The application role can read every row. The owner check is in the queries, not in row-level security. A session variable on a pooled connection survives into the next request, which would show one visitor another visitor’s cases. I refused that trade. The partial unique indexes are the part the database itself enforces.",
        ],
      },
      {
        heading: "What is shared, and what belongs to an email",
        body: [
          "departments, employees, policy_configs, and calendar_holidays are the office. They are seeded by the migrations and are not scoped to a user. A recommendation may name them. A visitor cannot insert them through the API.",
          "import_batches and cases carry owner_user_id. A verified email owns the rows it commits. The queue, the complaint, the policy check, and the decision all require that column to match the session. Rows with a null owner are leftovers from an earlier shared seed. The API does not return them and will not change them. The unique indexes still cover that null case, because PostgreSQL treats nulls as distinct and one index could not mean both things.",
          "Child tables do not repeat the owner. evaluations, review_decisions, follow_up_actions, and audit_events hang off a case or an evaluation by foreign key. They are loaded only after the case has already matched the session. import_rows hang off the batch the same way.",
        ],
      },
      {
        heading: "Why the function moved to Singapore",
        body: [
          "The first production function ran in Virginia. The database was already in Singapore. From Nepal the TLS handshake to Vercel finished in about a tenth of a second, and /api/health, a single SELECT 1, still took about 1.9 seconds. The dashboard was slower because it issues more than one query, and each one crossed the Pacific and came back.",
          "The function region is now sin1, the Vercel region next to aws-ap-southeast-1. The same health check then took about half a second, most of which is the hop from Nepal to Singapore. A cold compute still adds a pause on the first call after idle. That pause is the scale-to-zero behavior, not a missing index.",
        ],
      },
    ],
  },
  {
    path: "/how-it-is-built/schema",
    kicker: "Schema",
    title: "How a complaint is stored",
    description:
      "The tables, the keys, and the view that the queue is not allowed to outgrow.",
    lede: "A complaint is not one row. It is a staged file, a case, an append-only evaluation, a human decision, and an audit event that points at all of them.",
    sections: [
      {
        heading: "The office, which is not a tenant",
        body: [
          "departments has a code and a name. employees belongs to one department, has an escalation_level from 1 to 5, and can be marked inactive. The recommendation picks the first active person in the matched department at the lowest level. Four departments and seven people are inserted by the first migration. Their emails are example.invalid on purpose.",
          "policy_configs is one row per policy version. NP-GRIEVANCE-2026-V1 stores the timezone Asia/Kathmandu, working days Monday to Friday as ISO numbers, five working days, and due through the end of the calculated date. A missing date is required to be NEEDS_CLARIFICATION. calendar_holidays hangs off that policy, unique per policy and date. The seeded holidays are a slice of the 2083 calendar, not the full list.",
        ],
      },
      {
        heading: "The file, before it is a case",
        body: [
          "import_batches is one uploaded file. source_platform is whatsapp, website, facebook, or spreadsheet, chosen from the header rather than from a dropdown. source_fingerprint is a SHA-256 of the bytes. status is PREVIEW, COMMITTED, or CANCELLED. imported_by is the verified email. owner_user_id is the user.",
          "import_rows is one CSV line. original_values is the raw cells. proposed_values is the mapped intake. outcome is VALID, NEEDS_REVIEW, REJECTED, POSSIBLE_DUPLICATE, ALREADY_IMPORTED, or SOURCE_CHANGE_REVIEW. warnings and errors are JSON arrays. A duplicate points at duplicate_case_id. mapping_confidence and confirmed_by record an explicit override. The pair (batch_id, row_number) is unique.",
          "A case is inserted only when a person commits a row. It keeps import_batch_id and import_row_id, and import_row_id is unique, so one staged line cannot become two cases. original_values is copied onto the case. The normalized columns are title, description, received_date, normalized_status, and the intake a ward desk would actually have: complainant name, phone, district, local level, ward, place, category, and the relief they asked for. department_id and employee_id start empty unless the mapping already knew them. A later check fills them only while they are still empty, so a supervisor’s reassignment is not overwritten.",
        ],
      },
      {
        heading: "The evaluation, the decision, and the audit",
        body: [
          "evaluations is append-only. There is no update path. Each row stores the policy id and the version string, the rule id, input_facts, and deadline_calculation as JSON, the calculated deadline, the outcome, the recommended next step, the reason, and the suggested department and officer. The index is (case_id, evaluated_at DESC, id DESC) so “latest” is a single ordered lookup.",
          "review_decisions is one row per evaluation. evaluation_id is unique. The decision is APPROVED, REJECTED, REASSIGNED, or CLARIFICATION_REQUESTED. A check constraint requires a non-empty reason unless the decision is APPROVED. decided_by is the verified email, not a value the browser supplied.",
          "follow_up_actions is the work that was actually authorized. It points at the case and the evaluation, has a required department, an optional officer, a due date, and a status of OPEN, COMPLETED, or CANCELLED. Reject does not insert one.",
          "audit_events is append-only evidence. entity_type and entity_id say what changed. event_type is CASE_IMPORTED, POLICY_EVALUATED, or SUPERVISOR_DECISION_RECORDED. before_values and after_values are JSON. The actor and the event time are stored on the row. The index is (entity_type, entity_id, event_time, id) so the complaint sheet can show them in order.",
        ],
      },
      {
        heading: "Identity, and the keys that keep two visitors apart",
        body: [
          "users is an email and a timestamp. There is no password. email_codes stores an HMAC of the address and the six-digit code, the expiry, the attempt count, used_at, and the request IP. The raw code is not stored. sessions stores a SHA-256 of a 32-byte token, the user, and an expiry. The cookie holds the raw token.",
          "A case used to be unique on (source_platform, source_record_id) for the whole database. That made the sample file belong to whoever imported it first. The global constraints were dropped. Two partial unique indexes replaced them. One covers the null owner. The other covers (owner_user_id, source_platform, source_record_id) where the owner is present. Batches are split the same way on source_fingerprint. Duplicate detection uses IS NOT DISTINCT FROM so a null owner is compared only with other null owners.",
          "An empty source id is stored as NULL. PostgreSQL does not put NULL in a unique index, so those rows are compared by title inside the same owner. Two visitors can import the same sample. They do not share a batch.",
        ],
      },
      {
        heading: "The view the screen is allowed to read",
        body: [
          "case_operational_state is a view, replaced as later migrations added columns. It selects the case, the department name, the officer name and role, and the intake fields. Two lateral joins pick the latest evaluation and the latest follow-up. The decision is joined to that evaluation, not to the case, so a decision cannot attach itself to an older recommendation.",
          "The queue filters are predicates on this view: open, overdue, missing department, unassigned officer, waiting on the team, rejected. The counts use the same predicates. Pages are LIMIT and OFFSET. The owner predicate is applied here too. History stays in the tables. The view is only the current operational face, which is why the pill and the table cannot disagree.",
        ],
      },
    ],
  },
  {
    path: "/how-it-is-built/production",
    kicker: "Production",
    title: "How this is hosted",
    description:
      "GitHub Actions proves the commit. Vercel serves it. Neon holds it. The subdomain is only a DNS name.",
    lede: "Production is three pieces that do not try to do each other’s jobs. GitHub runs the tests. Vercel runs the app. Neon runs Postgres.",
    sections: [
      {
        heading: "What a push to main does",
        body: [
          "The repository is Abhishek-programs/grievance-escalation-console. A push and a pull request both run .github/workflows/ci.yml. The job checks out the code on Node 24, runs npm ci, starts the Compose Postgres, waits until it is healthy, migrates, generates the fictional exports, runs the tests, and builds the desk. If an earlier step fails, Compose is still shut down. The pipeline used to migrate before Postgres accepted connections. The health check is there because of that.",
          "The same repository is connected to a Vercel project named grievance-escalation-console. A push to main deploys production after that. The project framework is Express. The build command is npm run build, which is the Vite build into public/. The function region is sin1. Node on the project is 24.x. Vercel’s current 24.x image is slightly behind the 24.22 this repo uses locally for running TypeScript directly, so the engines field asks for 24.x and the platform compiles the server with the TypeScript compiler instead.",
        ],
      },
      {
        heading: "The environment the function actually sees",
        body: [
          "Production has four secrets. DATABASE_URL is the pooled Neon string. CODE_PEPPER is the HMAC key for sign-in codes. RESEND_API_KEY and RESEND_FROM are the mail credentials. In production, a missing pepper or a missing from-address refuses to send a code. The message is “Email delivery is not configured.” A variable added in the dashboard does not enter a deployment that has already been built. The running function keeps the environment it was deployed with, so a new secret needs a redeploy.",
          "NODE_ENV is production, so the session cookie is Secure, HttpOnly, SameSite=Lax, and lasts fourteen days. On Vercel the app sets trust proxy to 1. The platform overwrites the forwarded address, and the code-request cap then counts visitors rather than counting Vercel as one client.",
          "Preview deployments receive the same database and the same pepper. They are the pull-request URLs, not the public desk. The public name is the production deployment.",
        ],
      },
      {
        heading: "The name on the portfolio domain",
        body: [
          "bhattaraiabhishek.com.np stays the portfolio, which is a separate Vercel project. This desk is desk.bhattaraiabhishek.com.np on this project. The zone is served by Cloudflare. The records are a CNAME from desk to the project’s vercel-dns hostname, and a TXT at _vercel with the verification value Vercel issued. The CNAME is DNS only. Proxying it through Cloudflare produces a certificate the browser will not accept for this name.",
          "A resolver that looked the name up before the CNAME existed can cache “does not exist” for the SOA minimum, which on this zone is thirty minutes. Authoritative DNS and 1.1.1.1 already return the Vercel addresses. An ISP resolver can keep the negative answer until that cache expires.",
        ],
      },
      {
        heading: "What I would not pretend this is",
        body: [
          "After the tests pass on main, that same workflow applies any new file in server/migrations to Neon through the direct URL. Files already recorded in schema_migrations are skipped. A pull request never touches Neon. Vercel still deploys from the push, so a migration and the code that uses it can land a few seconds apart. The holiday list is still a slice. The staff directory is still fictional. The email code proves an inbox and does not prove a staff identity. The part that is already in the shape I would keep is the transaction around a decision, the view the queue reads, and the owner on the case.",
        ],
      },
    ],
  },
] as const;

export function buildDocument(path: string): { title: string; description: string } | null {
  if (path === "/how-it-is-built") {
    return {
      title: "How this desk is built",
      description:
        "A build log of the grievance desk: the API, the database, the schema, and the production setup.",
    };
  }
  const note = buildNotes.find((item) => item.path === path);
  if (!note) return null;
  return { title: note.title, description: note.description };
}

export function BuildNote({
  dark,
  onToggleTheme,
}: {
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const { slug } = useParams();
  const note = buildNotes.find((item) => item.path === `/how-it-is-built/${slug}`);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-11 w-[min(1328px,calc(100%-2.5rem))] items-center justify-between gap-4">
          <Link to="/how-it-is-built" className="text-sm text-(--link)">
            All notes
          </Link>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        </div>
      </header>
      <main className="mx-auto w-[min(1328px,calc(100%-2.5rem))] flex-1 pt-8 pb-20">
        {note ? <Note note={note} /> : <Missing />}
      </main>
    </div>
  );
}

function Note({ note }: { note: (typeof buildNotes)[number] }) {
  const index = buildNotes.findIndex((item) => item.path === note.path);
  const next = buildNotes[index + 1];
  return (
    <>
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {note.kicker}
      </p>
      <h1 className="mt-4 max-w-[42rem] text-[clamp(36px,3.7vw,54px)]">{note.title}</h1>
      <p className="mt-6 max-w-[42rem] text-sm leading-[1.9] text-muted-foreground">{note.lede}</p>
      <div className="mt-14 max-w-[42rem]">
        {note.sections.map((section) => (
          <section key={section.heading} className="border-t border-border py-10">
            <h2 className="text-xl">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-sm leading-[1.85]">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <nav className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border py-10 text-sm">
          <Link to="/how-it-is-built" className="text-(--link)">
            All notes
          </Link>
          {next ? (
            <Link to={next.path} className="text-(--link)">
              {next.title}
            </Link>
          ) : (
            <Link to="/" className="text-(--link)">
              Back to the desk
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}

function Missing() {
  return (
    <>
      <h1 className="max-w-[42rem] text-[clamp(36px,3.7vw,54px)]">That note is not in this log</h1>
      <p className="mt-6 max-w-[42rem] text-sm leading-[1.9] text-muted-foreground">
        The longer notes are the backend, the database, the schema, and production.
      </p>
      <Link to="/how-it-is-built" className="mt-8 inline-block text-sm text-(--link)">
        All notes
      </Link>
    </>
  );
}
