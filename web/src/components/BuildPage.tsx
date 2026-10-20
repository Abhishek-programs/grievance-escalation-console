import { Link } from "react-router";
import { buildNotes } from "./BuildNotes.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { buttonVariants } from "./ui/button.tsx";

const buildPath = "/how-it-is-built";

const sections = [
  {
    n: "01",
    kicker: "The job",
    title: "The hard part is the write, not the table",
    body: [
      "This is a grievance desk for a reviewer, a desk officer, and a supervisor. Complaints arrive as CSV exports from WhatsApp, a website form, Facebook, or a spreadsheet. The desk proposes a department and an officer, counts five Monday-to-Friday working days in Asia/Kathmandu, and keeps the supervisor’s decision on the same case. Every person, ward, and complaint is fictional. The holiday list is a slice of the 2083 public calendar, not the full ministry list.",
      "I started from the write path because that is where a complaint system becomes dishonest. A row can be missing a date, repeat a source id, or look like another case. If those land in the queue as ordinary open work, the officer cannot tell what was accepted and what was guessed. The screen is the last step. The product is a series of writes that can still be explained later: what arrived, what was accepted, who was assigned, and why the deadline is that date.",
      "A production desk would swap in the real holiday calendar and the real staff directory. The shape of the write would stay. That is the part I wanted a hiring reader to be able to trace.",
    ],
  },
  {
    n: "02",
    kicker: "The stack",
    title: "Node runs the TypeScript. PostgreSQL holds the rules",
    body: [
      "The API is Express 5 on Node 24. The server sources are TypeScript, and Node runs them directly, so a change to a transaction is the process that is already listening. React 19 is the desk, and React Router gives this log its own addresses. Vite proxies /api during development. PostgreSQL 18 is the only store. Migrations in server/migrations apply in filename order and record themselves in schema_migrations. docs/openapi.yaml is the HTTP contract.",
      "I kept the queries in the service that depends on them. The behavior worth reviewing is a unique key, a row lock, a savepoint, and a view of the latest evaluation. An ORM would have hidden those behind a model that does not know about partial indexes or FOR UPDATE. There is no queue and no model call. The deadline is a function over stored policy, and the recommendation is a rule over that date.",
      "The desk stays one route. Import, the queue, and the complaint sheet share the same operational state, and splitting that workflow into pages would have made it look larger than it is. This log is the other route. Each longer note has its own path, and the browser back button returns to the section you left.",
    ],
  },
  {
    n: "03",
    kicker: "Import",
    title: "A file is staged before it is allowed to become a case",
    body: [
      "The CSV header chooses the channel. message_id is WhatsApp, submission_id is the website, post_ref is Facebook, and complaint_no is a spreadsheet. Anything else is refused. I removed the platform dropdown after watching it ask the reviewer to know something the file already says. Each channel keeps its own column names. The mapped record is the same intake a ward desk would actually receive: who wrote, a phone number, district, local level, ward, place, category, what happened, and what they asked the office to do.",
      "Preview and commit are different writes. Preview stores an import batch and one row per line, with the original JSON beside the proposed reading. The outcomes are VALID, NEEDS_REVIEW, REJECTED, POSSIBLE_DUPLICATE, ALREADY_IMPORTED, and SOURCE_CHANGE_REVIEW. A SHA-256 of the bytes is the batch fingerprint. The same file from the same visitor reopens that preview, including rows already committed, so the rest can still be accepted. A file is capped at 200 rows. The body limit is 512 KB.",
      "Recognized statuses are open, resolved, and in progress. Dates must be 2026-MM-DD, DD/10/2026, or D Oct 2026. A missing title is rejected. A missing date or an unknown status stays in the preview for a person to confirm. The original cell values stay attached after commit, so a later argument about what the export said does not depend on the normalized columns.",
    ],
  },
  {
    n: "04",
    kicker: "Transactions",
    title: "One bad row rolls back to a savepoint",
    body: [
      "Commit takes a database connection that the route has already begun. The selected import rows are locked with FOR UPDATE. Each insert then runs inside SAVEPOINT row_commit. If that insert hits the case key, PostgreSQL aborts only the savepoint. The route reports the row as skipped and continues. The surrounding transaction still commits the rows that succeeded.",
      "That distinction matters. A unique violation outside a savepoint aborts the whole transaction, and the next statement fails with a message that has nothing to do with the row. The savepoint is the difference between “this line already exists” and “the batch is lost.” The batch stays PREVIEW while any committable row is still waiting. It becomes COMMITTED only when those rows are cases.",
      "REJECTED, ALREADY_IMPORTED, and SOURCE_CHANGE_REVIEW cannot be forced through. A possible duplicate, usually the same title under a different source id, is written only when the reviewer sends that id in confirmedRowIds. The default is caution. The override is explicit.",
    ],
  },
  {
    n: "05",
    kicker: "Identity",
    title: "A source id is unique for one owner",
    body: [
      "A case is unique on source platform and source record id. That was a single global constraint while the desk had one reviewer. It broke as soon as a second person could upload. The sample file would belong to whoever imported it first, and the next visitor would be told the rows were already imported.",
      "An early version kept a shared seed under a null owner. A verified visitor has a user id. PostgreSQL unique indexes treat nulls as distinct, so one index cannot mean both “one unowned row” and “one copy per visitor.” I split them. A partial unique index covers rows where owner_user_id is null. Another covers (owner, platform, source id) where the owner is present. The fingerprint on a batch is split the same way. Duplicate checks use IS NOT DISTINCT FROM so a null owner is compared with other null owners, not with every visitor. The API no longer returns those unowned rows. A session matches its own owner_user_id and nothing else.",
      "An empty source id is stored as NULL. PostgreSQL leaves NULL out of a unique index, so those rows are compared by title inside that same owner. I would rather name that limit than pretend a blank cell is an identity. Two visitors can import the same sample. They do not share a batch, and neither of them can open the other’s cases.",
    ],
  },
  {
    n: "06",
    kicker: "Time",
    title: "The deadline is policy data, and every day is stored",
    body: [
      "Policy NP-GRIEVANCE-2026-V1 is rows in policy_configs and calendar_holidays: timezone Asia/Kathmandu, working days Monday to Friday, five working days, due through the end of the calculated date. The calculator walks forward one UTC calendar day at a time and marks each day as a working day, a weekly holiday, or a public holiday. The evaluation stores that trace. “Today” is the Kathmandu date from Intl, not the offset of the machine running the API.",
      "I parsed dates as UTC calendar days so a server in another zone cannot move 2 October onto 1 October. The three accepted input formats are explicit. I did not guess month-first versus day-first. An unreadable date, an ambiguous status, or a complaint that matches no department returns NEEDS_CLARIFICATION and does not invent a deadline. An open case after the stored date returns ESCALATE.",
      "The queue shows a phrase: inside the deadline, due today, past the deadline, or deadline not set. The day list stays behind “How the days were counted” on the complaint. An officer needs the result. A reviewer of the system needs the trace. Both are on the case.",
    ],
  },
  {
    n: "07",
    kicker: "Decisions",
    title: "The decision and the follow-up commit together",
    body: [
      "Recording a decision locks the evaluation with FOR UPDATE. Approve may omit a reason. Reject, reassign, and a request for clarification each require one. Reject writes the decision and the audit event and does not open a follow-up. Authorizing work that was refused would have been a second, contradictory write.",
      "The other three decisions need a department and a due date. The same transaction inserts the follow-up, updates the case’s department and officer, and appends SUPERVISOR_DECISION_RECORDED. The audit row keeps the recommendation it answered, the decision, the reason, the actor, and the policy version. If the follow-up cannot be written, the route rolls the transaction back. A test approves an evaluation that has no department and checks that no decision row remains.",
      "The actor used to be a string the browser sent. It is now the verified email from the session. A client-supplied actor id is not an audit trail.",
    ],
  },
  {
    n: "08",
    kicker: "The read model",
    title: "The queue is a view, so the screen cannot invent a status",
    body: [
      "History stays in the tables. case_operational_state exposes the latest evaluation, the decision on that evaluation, and the latest follow-up through lateral joins. Open, overdue, missing department, unassigned officer, waiting on the team, and rejected are filters on that view. The counts use the same filters, so the pill and the table cannot disagree. Pages are LIMIT and OFFSET in SQL.",
      "Opening a complaint loads the case, the import row, every evaluation, every decision, the follow-ups, and the audit log. The sheet leads with the grievance: who sent it, where they are, what happened, and what they asked for. The deadline and the decision sit under that. The audit is a disclosure. An earlier version of the sheet was a stack of empty process sections and a one-line “fictional report.” The intake was too thin, and the screen advertised the machinery.",
      "Department assignment is a readable rule, not a classifier. The text is the category plus the complaint: water, road or transport or drain, clinic or health or vaccine, certificate or citizenship or registration. The officer is the first active person in that department at the lowest escalation level. A later check fills department and officer only while those fields are still empty, so a supervisor’s reassignment is not overwritten. A complaint outside those words stays unassigned and shows up in the missing-department queue. That queue is the honest empty state of a directory I have not been given.",
    ],
  },
  {
    n: "09",
    kicker: "Access",
    title: "Each email sees only the complaints it imported",
    body: [
      "Hosting this on a portfolio site has two failure modes. One visitor can upload until the disk and the database fill. Every visitor otherwise shares one mutable desk, so a stranger can reject the demonstration. I did not add accounts, passwords, or an organization model. The gate is an email code.",
      "The API still requires a session for a queue, a complaint, an import, a policy check, and a supervisor decision. With no session the page shows the sample instead, and keeps imports, checks, and decisions in localStorage. The visitor can enter an email when they want a desk of their own. Resend sends a 6-digit code. The code is stored as an HMAC of the address and the code, keyed with a server pepper, because a plain hash of six digits can be reversed from a copy of the table. It expires in ten minutes and allows five attempts. The guess takes a row lock, and a new code takes an advisory lock, so parallel requests cannot slip past either cap. Asking for a code is also capped per address and per IP, because the form would otherwise spend the email quota. The session is an httpOnly cookie for fourteen days, and Secure in production. The code is never returned in the JSON.",
      "New batches and cases store that user id. The queue is only those rows. Opening a case, checking the deadline, and recording a decision succeed only when the session owns the row. Another address gets an empty response and a not-found. A fingerprint and a source id are unique per owner, so two people can import the same sample without sharing it. The browser sample is a separate copy and is not one of those rows.",
    ],
  },
  {
    n: "10",
    kicker: "Proof",
    title: "The tests run against the same PostgreSQL",
    body: [
      "node:test talks to the local database. Import tests cover header detection, a changed source record, a repeated file, committing the rows that are still open, and the same source id existing for two owners. Policy tests walk a Friday, a public holiday, an inclusive due date, and a missing date. The decision test checks the rollback. Auth tests check that a code verifies once and that five misses retire it. The import suite truncates case data before each test and leaves the directory and the policy in place.",
      "Continuous integration waits until Postgres is healthy, then migrates, generates the fictional exports, runs the tests, and builds the desk. The health check is there because an earlier pipeline ran migrate before the database accepted connections.",
      "The screen defaults to dark, and the theme is set from local storage before the first paint so the page does not flash. The mark in the footer is the same mark as the favicon. What I would replace in a real office is the keyword directory, the partial holiday list, and the email code, which proves an inbox and does not prove a staff identity. The transactions, the view, and the owner-scoped keys are the part I would keep.",
    ],
  },
];

export function BuildLink() {
  return (
    <Link to={buildPath} className="group block border-t border-border bg-secondary">
      <div className="mx-auto w-[min(1328px,calc(100%-2.5rem))] py-16 md:py-24">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Build log
        </p>
        <p className="mt-4 max-w-4xl font-display text-[clamp(36px,3.7vw,54px)] leading-[1.13] font-medium tracking-[-0.055em] text-balance group-hover:text-(--link)">
          How this desk is built
        </p>
        <p className="mt-4 max-w-[40rem] text-sm leading-[1.9] text-muted-foreground">
          A build log of the stack, the transactions, and the sign-in boundary.
          Written the way I would explain the system in a review.
        </p>
        <span className={`${buttonVariants()} mt-8`}>Read the build</span>
      </div>
    </Link>
  );
}

export function BuildPage({
  dark,
  onToggleTheme,
}: {
  dark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-11 w-[min(1328px,calc(100%-2.5rem))] items-center justify-between gap-4">
          <Link to="/" className="text-sm text-(--link)">
            Back to the desk
          </Link>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        </div>
      </header>
      <main className="mx-auto w-[min(1328px,calc(100%-2.5rem))] flex-1 pt-8 pb-20">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Build log
        </p>
        <h1 className="mt-4 max-w-5xl text-[clamp(36px,3.7vw,54px)]">
          How this desk is built
        </h1>
        <p className="mt-4 max-w-[42rem] text-sm leading-[1.9] text-muted-foreground">
          Ten short notes from the implementation, then four longer ones on the
          API, the database, the schema, and production.
        </p>
        <p className="mt-10 max-w-6xl font-display text-[1.65rem] leading-[1.25] font-medium tracking-[-0.04em] text-balance">
          A write is finished when a later reader can see why it was allowed.
        </p>
        <p className="mt-8 text-[11px] tracking-wide text-muted-foreground uppercase">
          TypeScript · Node 24 · Express 5 · PostgreSQL 18 · Neon · React 19 ·
          React Router · Vite · Resend
        </p>
        <nav className="mt-14 max-w-[42rem] border-t border-border">
          {buildNotes.map((note, index) => (
            <Link
              key={note.path}
              to={note.path}
              className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-border py-5"
            >
              <span className="pt-1 text-[11px] text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="text-sm text-(--link)">{note.title}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                  {note.description}
                </span>
              </span>
            </Link>
          ))}
        </nav>
        <div className="mt-16">
          {sections.map((section) => (
            <section
              key={section.n}
              className="grid grid-cols-[3rem_1fr] gap-x-4 border-t border-border py-10"
            >
              <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
                {section.n}
              </p>
              <div>
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {section.kicker}
                </p>
                <h2 className="mt-2 text-xl">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-[1.8]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
          <section className="border-t border-border py-10">
            <Link to="/" className={buttonVariants()}>
              Back to the desk
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
