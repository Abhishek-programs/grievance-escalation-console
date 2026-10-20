import type { ICaseTable, ICaseTableItem } from "../types/case-table.ts";
import { formatDate, humanize, tone } from "../format.ts";

export function CaseTable({
  result,
  loading,
  onOpen,
  onPage,
}: {
  result: ICaseTable;
  loading: boolean;
  onOpen: (id: string) => void;
  onPage: (page: number) => void;
}): React.ReactElement {
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);
  return (
    <section className="panel" aria-busy={loading}>
      <div className="panel-head">
        <h2>Cases</h2>
        <p>{loading ? "Loading queue…" : `${from}–${to} of ${result.total}`}</p>
      </div>
      {result.items.length === 0 ? (
        <p className="empty">{loading ? "Loading cases…" : "No cases in this queue."}</p>
      ) : (
        <div className="table-wrap">
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
                <tr key={item.id} onClick={() => onOpen(item.id)}>
                  <td>{item.title}</td>
                  <td>
                    <span className={tone(item.normalized_status)}>
                      {humanize(item.normalized_status)}
                    </span>
                  </td>
                  <td className={item.department_name ? undefined : "missing"}>
                    {item.department_name ?? "Missing"}
                  </td>
                  <td>
                    <span className={tone(item.recommendation_outcome)}>
                      {humanize(item.recommendation_outcome, "Not evaluated")}
                    </span>
                  </td>
                  <td>{formatDate(item.follow_up_due_date)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(item.id);
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        <button
          type="button"
          disabled={result.page <= 1 || loading}
          onClick={() => onPage(result.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {result.page} of {pageCount}
        </span>
        <button
          type="button"
          disabled={result.page >= pageCount || loading}
          onClick={() => onPage(result.page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
