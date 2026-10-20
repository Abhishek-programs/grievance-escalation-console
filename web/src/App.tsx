import { useEffect, useState } from "react";
import { request } from "./api.ts";
import { MetricCards } from "./components/MetricCards.tsx";
import { CaseTable } from "./components/CaseTable.tsx";
import { EvidenceDrawer } from "./components/EvidenceDrawer.tsx";
import { IEvidence } from "./types/evidence.ts";
import type { ICaseTable } from "./types/case-table.ts";

interface Dashboard {
  metrics: Record<string, number>;
  cases: ICaseTable;
}

export default function App() {
  const [bucket, setBucket] = useState("open");
  const [dashboard, setDashboard] = useState<Dashboard>({
    metrics: {},
    cases: { items: [], page: 1, total: 0 },
  });
  const [evidence, setEvidence] = useState<IEvidence | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request<Dashboard>(`/api/dashboard?bucket=${bucket}&page=1&pageSize=25`, {
      method: "GET",
    })
      .then((data) => setDashboard(data))
      .catch((caught) => setError(caught.message));
  }, [bucket]);
  async function openEvidence(caseId: string) {
    try {
      setEvidence(
        await request<IEvidence>(`/api/cases/${caseId}/evidence`, {
          method: "GET",
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  }
  return (
    <main>
      <h1>Grievance Escalation Console</h1>
      {error && <p role="alert">{error}</p>}
      <MetricCards
        metrics={dashboard.metrics}
        active={bucket}
        onSelect={setBucket}
      />
      <CaseTable result={dashboard.cases} onOpen={openEvidence} />
      <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
    </main>
  );
}
