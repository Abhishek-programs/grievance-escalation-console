import { Mark } from "./Mark.tsx";

export function PocFooter() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="mx-auto flex w-[min(1328px,calc(100%-2.5rem))] items-center gap-4 pt-12 pb-8">
        <Mark className="size-12 shrink-0" />
        <div>
          <p className="font-display text-4xl leading-none font-semibold tracking-[-0.06em] text-foreground">Grievance desk</p>
          <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-muted-foreground">A portfolio piece for reviewing fictional complaints.</p>
        </div>
      </div>
      <div className="mx-auto grid w-[min(1328px,calc(100%-2.5rem))] gap-8 pb-14 text-sm leading-relaxed text-muted-foreground md:grid-cols-3">
        <section className="space-y-2">
          <h2 className="text-base text-foreground">This is a proof of concept</h2>
          <p>
            The desk runs locally with fictional complaints, departments, and officers. It is not connected to a live intake system, and the records here are not official cases.
          </p>
          <p>
            The deadline rule is a demonstration: five Monday-to-Friday working days, due through the end of that local date. A missing date asks for clarification. A production desk would load the full holiday calendar and the real staff directory.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-base text-foreground">Where it sits in the workflow</h2>
          <p>
            Source files arrive as CSV exports. A reviewer previews each file, accepts the rows that are ready, and commits them. Commit runs the policy check, assigns a department, and names an officer to forward to.
          </p>
          <p>
            The queues then hold the open work. An officer opens a complaint, reads the recommendation, and a supervisor records approve, reject, reassign, or a request for clarification. That decision and any follow-up stay on the same case.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-base text-foreground">Who uses it</h2>
          <p>
            <span className="text-foreground">Import reviewer.</span> Brings in WhatsApp, website, Facebook, and spreadsheet files, checks warnings and duplicates, and commits the rows that should become cases.
          </p>
          <p>
            <span className="text-foreground">Desk officer.</span> Works the queues, reads the description and policy result, and forwards each complaint to the named officer.
          </p>
          <p>
            <span className="text-foreground">Supervisor.</span> Accepts or rejects the recommendation, reassigns it, or asks for clarification, and leaves a reason the queue can show without opening the complaint.
          </p>
        </section>
      </div>
    </footer>
  );
}
