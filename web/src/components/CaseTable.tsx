import type { ICaseTable, ICaseTableItem } from "../types/case-table.ts";
import { humanize, policyTiming } from "../format.ts";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";

const outcomeTone: Record<string, string> = {
  ESCALATE: "bg-(--red-bg) text-(--red)",
  MONITOR: "bg-(--green-bg) text-(--green)",
  NEEDS_CLARIFICATION: "bg-(--amber-bg) text-(--amber)",
  REJECTED: "bg-(--red-bg) text-(--red)",
  APPROVED: "bg-(--green-bg) text-(--green)",
};

export function CaseTable({
  result,
  title,
  loading,
  onOpen,
  onPage,
}: {
  result: ICaseTable;
  title: string;
  loading: boolean;
  onOpen: (id: string) => void;
  onPage: (page: number) => void;
}): React.ReactElement {
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);
  return (
    <Card aria-busy={loading} className="shadow-(--shadow)">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading queue…" : `${from}–${to} of ${result.total}`}
        </p>
      </CardHeader>
      <CardContent>
        {result.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading complaints…" : "No complaints in this queue."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Policy check</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Forward to</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((item: ICaseTableItem) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">{humanize(item.normalized_status)}</p>
                  </TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">
                    {item.description || "No description"}
                  </TableCell>
                  <TableCell>
                    <PolicyCheck item={item} />
                  </TableCell>
                  <TableCell>
                    {item.decision ? (
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${outcomeTone[item.decision] ?? "bg-secondary text-secondary-foreground"}`}>
                          {humanize(item.decision)}
                        </span>
                        {item.decision_reason && <p>{item.decision_reason}</p>}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No decision yet</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.employee_name ? (
                      <>
                        <p className="font-medium">{item.employee_name}</p>
                        <p className="text-muted-foreground">
                          {item.employee_role}
                          {item.department_name ? ` · ${item.department_name}` : ""}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-(--amber)">No officer matched</p>
                        <p className="text-muted-foreground">
                          {item.department_name ?? "Department still needed"}
                        </p>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button type="button" size="sm" onClick={() => onOpen(item.id)}>
                      View complaint
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={result.page <= 1 || loading} onClick={() => onPage(result.page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {result.page} of {pageCount}
          </span>
          <Button type="button" variant="outline" disabled={result.page >= pageCount || loading} onClick={() => onPage(result.page + 1)}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PolicyCheck({ item }: { item: ICaseTableItem }) {
  const outcome = item.recommendation_outcome;
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${outcome ? outcomeTone[outcome] ?? "bg-secondary text-secondary-foreground" : "bg-secondary text-secondary-foreground"}`}>
        {humanize(outcome, "Not checked")}
      </span>
      <p>{item.recommended_next_step ?? "Import runs the policy check."}</p>
      <p className="text-muted-foreground">{policyTiming(item.calculated_deadline, outcome)}</p>
    </div>
  );
}
