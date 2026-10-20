import type { ICaseTable, ICaseTableItem } from "../types/case-table.ts";

export function CaseTable({
  result,
  onOpen,
}: {
  result: ICaseTable;
  onOpen: (id: string) => void;
}): React.ReactElement {
  // Keep operational columns visible before the evidence drawer opens.
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Status</th>
            <th>Department</th>
            <th>Recommendation</th>
            <th>Follow-up</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((item: ICaseTableItem) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.normalized_status}</td>
              <td>{item.department_name ?? "Missing"}</td>
              <td>{item.recommendation_outcome ?? "Not evaluated"}</td>
              <td>{item.follow_up_due_date ?? "None"}</td>
              <td>
                <button type="button" onClick={() => onOpen(item.id)}>
                  Open evidence
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Page {result.page}. Showing {result.items.length} of {result.total}{" "}
        cases.
      </p>
    </section>
  );
}
