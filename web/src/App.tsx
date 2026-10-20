import { useCallback, useEffect, useState } from "react";
import { bucketDescriptions, request } from "./api.ts";
import { CaseTable } from "./components/CaseTable.tsx";
import { EvidenceDrawer } from "./components/EvidenceDrawer.tsx";
import { ImportReview } from "./components/ImportReview.tsx";
import { MetricCards } from "./components/MetricCards.tsx";
import { Badge } from "./components/ui/badge.tsx";
import { Input } from "./components/ui/input.tsx";
import { Label } from "./components/ui/label.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs.tsx";
import { Alert } from "./components/ui/alert.tsx";
import type { ICaseTable } from "./types/case-table.ts";
import type { IEvidence } from "./types/evidence.ts";

interface Dashboard {
  metrics: Record<string, number>;
  cases: ICaseTable;
}

const pageSize = 25;

export default function App() {
  const [bucket, setBucket] = useState("open");
  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState("import-reviewer");
  const [dashboard, setDashboard] = useState<Dashboard>({
    metrics: {},
    cases: { items: [], page: 1, pageSize, total: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<IEvidence | null>(null);
  const [health, setHealth] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    request<{ database: boolean }>("/api/health", { method: "GET" })
      .then((data) => setHealth(data.database))
      .catch(() => setHealth(false));
  }, [refreshToken]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    request<Dashboard>(
      `/api/dashboard?bucket=${bucket}&page=${page}&pageSize=${pageSize}`,
      { method: "GET" },
    )
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Request failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bucket, page, refreshToken]);

  const loadEvidence = useCallback(async (id: string) => {
    setEvidence(await request<IEvidence>(`/api/cases/${id}/evidence`, { method: "GET" }));
  }, []);

  async function openEvidence(id: string) {
    try {
      setError("");
      setCaseId(id);
      await loadEvidence(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  }

  const closeEvidence = useCallback(() => {
    setCaseId(null);
    setEvidence(null);
  }, []);

  async function refreshEvidence() {
    setRefreshToken((value) => value + 1);
    if (caseId) await loadEvidence(caseId);
  }

  function selectBucket(next: string) {
    setError("");
    setBucket(next);
    setPage(1);
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Grievance Escalation Console</h1>
          <p className="text-sm text-muted-foreground">
            {bucketDescriptions[bucket as keyof typeof bucketDescriptions]}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <Badge variant={health ? "default" : "destructive"}>
            {health === null ? "Checking API…" : health ? "Database connected" : "API unavailable"}
          </Badge>
          <div className="space-y-1">
            <Label htmlFor="actor-id">Your id</Label>
            <Input id="actor-id" value={actorId} onChange={(event) => setActorId(event.target.value)} />
          </div>
        </div>
      </header>
      {error && <Alert>{error}</Alert>}
      <Tabs defaultValue="queues">
        <TabsList>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>
        <TabsContent value="queues" className="space-y-4">
          <MetricCards metrics={dashboard.metrics} active={bucket} onSelect={selectBucket} />
          <CaseTable result={dashboard.cases} loading={loading} onOpen={openEvidence} onPage={setPage} />
        </TabsContent>
        <TabsContent value="import">
          <ImportReview actorId={actorId.trim()} onCommitted={() => setRefreshToken((value) => value + 1)} />
        </TabsContent>
      </Tabs>
      <EvidenceDrawer
        evidence={evidence}
        actorId={actorId.trim()}
        onClose={closeEvidence}
        onChanged={refreshEvidence}
      />
    </main>
  );
}
