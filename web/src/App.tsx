import { useCallback, useEffect, useState } from "react";
import { bucketDescriptions, request } from "./api.ts";
import { MetricCards } from "./components/MetricCards.tsx";
import { CaseTable } from "./components/CaseTable.tsx";
import { EvidenceDrawer } from "./components/EvidenceDrawer.tsx";
import { IEvidence } from "./types/evidence.ts";
import type { ICaseTable } from "./types/case-table.ts";

interface Dashboard {
  metrics: Record<string, number>;
  cases: ICaseTable;
}

const pageSize = 25;

export default function App() {
  const [bucket, setBucket] = useState("open");
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState<Dashboard>({
    metrics: {},
    cases: { items: [], page: 1, pageSize, total: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<IEvidence | null>(null);
  const [error, setError] = useState("");
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
        if (active)
          setError(caught instanceof Error ? caught.message : "Request failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bucket, page]);
  function selectBucket(next: string) {
    setError("");
    setBucket(next);
    setPage(1);
  }
  async function openEvidence(caseId: string) {
    try {
      setError("");
      setEvidence(
        await request<IEvidence>(`/api/cases/${caseId}/evidence`, {
          method: "GET",
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  }
  const closeEvidence = useCallback(() => setEvidence(null), []);
  return (
    <main>
      <header className="top">
        <h1>Grievance Escalation Console</h1>
        <p>{bucketDescriptions[bucket as keyof typeof bucketDescriptions]}</p>
      </header>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <MetricCards
        metrics={dashboard.metrics}
        active={bucket}
        onSelect={selectBucket}
      />
      <CaseTable
        result={dashboard.cases}
        loading={loading}
        onOpen={openEvidence}
        onPage={setPage}
      />
      <EvidenceDrawer evidence={evidence} onClose={closeEvidence} />
    </main>
  );
}
