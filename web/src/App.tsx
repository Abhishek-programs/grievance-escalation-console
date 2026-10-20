import { useCallback, useEffect, useState } from "react";
import { bucketDescriptions, bucketLabels, request } from "./api.ts";
import { CaseTable } from "./components/CaseTable.tsx";
import { DeskHeader } from "./components/DeskHeader.tsx";
import { EvidenceDrawer } from "./components/EvidenceDrawer.tsx";
import { ImportReview } from "./components/ImportReview.tsx";
import { MetricCards } from "./components/MetricCards.tsx";
import { PocFooter } from "./components/PocFooter.tsx";
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
  const actorId = "import-reviewer";
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
  const [dark, setDark] = useState(() => localStorage.getItem("sdoc-theme") !== "light");

  useEffect(() => {
    const theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sdoc-theme", theme);
  }, [dark]);

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
    <div className="flex min-h-screen flex-col">
      <DeskHeader
        summary={bucketDescriptions[bucket as keyof typeof bucketDescriptions]}
        health={health}
        dark={dark}
        onToggleTheme={() => setDark((value) => !value)}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        {error && <Alert>{error}</Alert>}
        <ImportReview actorId={actorId.trim()} onCommitted={() => setRefreshToken((value) => value + 1)} />
        <MetricCards metrics={dashboard.metrics} active={bucket} onSelect={selectBucket} />
        <CaseTable
          result={dashboard.cases}
          title={bucketLabels[bucket as keyof typeof bucketLabels]}
          loading={loading}
          onOpen={openEvidence}
          onPage={setPage}
        />
      </main>
      <PocFooter />
      <EvidenceDrawer
        evidence={evidence}
        actorId={actorId.trim()}
        onClose={closeEvidence}
        onChanged={refreshEvidence}
      />
    </div>
  );
}
