export function PocFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 text-sm text-muted-foreground md:grid-cols-3">
        <section className="space-y-2">
          <h2 className="font-medium text-foreground">This is a proof of concept</h2>
          <p>
            The desk runs locally with fictional complaints, departments, and officers. It is not connected to a live intake system, and the records here are not official cases.
          </p>
          <p>
            The deadline rule is a demonstration: five Monday-to-Friday working days, due through the end of that local date. A missing date asks for clarification. A production desk would load the full holiday calendar and the real staff directory.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-medium text-foreground">Where it sits in the workflow</h2>
          <p>
            Source files arrive as CSV exports. A reviewer previews each file, accepts the rows that are ready, and commits them. Commit runs the policy check, assigns a department, and names an officer to forward to.
          </p>
          <p>
            The queues then hold the open work. An officer opens a complaint, reads the recommendation, and a supervisor records approve, reject, reassign, or a request for clarification. That decision and any follow-up stay on the same case.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-medium text-foreground">Who uses it</h2>
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
