import type { ICaseTable, ICaseTableItem } from "../types/case-table.ts";
import { badgeVariant, formatDate, humanize } from "../format.ts";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";

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
    <Card aria-busy={loading}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Cases</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading queue…" : `${from}–${to} of ${result.total}`}
        </p>
      </CardHeader>
      <CardContent>
        {result.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading cases…" : "No cases in this queue."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((item: ICaseTableItem) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpen(item.id)}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(item.normalized_status)}>
                      {humanize(item.normalized_status)}
                    </Badge>
                  </TableCell>
                  <TableCell className={item.department_name ? undefined : "text-amber-700"}>
                    {item.department_name ?? "Missing"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(item.recommendation_outcome)}>
                      {humanize(item.recommendation_outcome, "Not evaluated")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(item.follow_up_due_date)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(item.id);
                      }}
                    >
                      Open
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
