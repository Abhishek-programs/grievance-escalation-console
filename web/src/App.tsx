import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { bucketDescriptions, bucketLabels, request } from "./api.ts";
import { BuildLink, BuildPage } from "./components/BuildPage.tsx";
import { BuildNote, buildDocument } from "./components/BuildNotes.tsx";
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
  const [email, setEmail] = useState<string | null>(null);
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
  const { pathname } = useLocation();
  const toggleTheme = () => setDark((value) => !value);

  useEffect(() => {
    const theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sdoc-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#181a1d" : "#fcfcfb");
  }, [dark]);

  useEffect(() => {
    const built = buildDocument(pathname);
    const title = built?.title ?? "Grievance desk";
    const description =
      built?.description ??
      "A review-first desk for fictional grievances. Import a complaint, check the deadline, and see who should receive it.";
    document.title = title;
    for (const name of ["description", "og:description", "twitter:description"]) {
      document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.setAttribute("content", description);
    }
    for (const name of ["og:title", "twitter:title"]) {
      document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.setAttribute("content", title);
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    request<{ email: string | null }>("/api/auth/session", { method: "GET" })
      .then((data) => setEmail(data.email))
      .catch(() => setEmail(null));
  }, []);

  useEffect(() => {
    request<{ database: boolean }>("/api/health", { method: "GET" })
      .then((data) => setHealth(data.database))
      .catch(() => setHealth(false));
  }, [refreshToken]);

  useEffect(() => {
    if (pathname !== "/") return;
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
        if (!active) return;
        const message = caught instanceof Error ? caught.message : "Request failed";
        if (message !== "The desk could not reach the API.") setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bucket, page, refreshToken, pathname, email]);

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

  const theme = { dark, onToggleTheme: toggleTheme };

  return (
    <Routes>
      <Route path="/how-it-is-built" element={<BuildPage {...theme} />} />
      <Route path="/how-it-is-built/:slug" element={<BuildNote {...theme} />} />
      <Route
        path="/"
        element={
          <div className="flex min-h-screen flex-col">
            <DeskHeader
              health={health}
              email={email}
              dark={dark}
              onToggleTheme={toggleTheme}
              onSignOut={() => {
                void request("/api/auth/logout", { method: "POST" }).finally(() => setEmail(null));
              }}
            />
            <main className="mx-auto flex w-[min(1328px,calc(100%-2.5rem))] flex-1 flex-col gap-8 py-7 pb-14">
              {error && <Alert>{error}</Alert>}
              <ImportReview
                email={email}
                onSignedIn={(next) => {
                  setEmail(next);
                  setRefreshToken((value) => value + 1);
                }}
                onCommitted={() => setRefreshToken((value) => value + 1)}
              />
              <MetricCards metrics={dashboard.metrics} active={bucket} onSelect={selectBucket} />
              <CaseTable
                result={dashboard.cases}
                title={bucketLabels[bucket as keyof typeof bucketLabels]}
                description={bucketDescriptions[bucket as keyof typeof bucketDescriptions]}
                loading={loading}
                onOpen={openEvidence}
                onPage={setPage}
              />
            </main>
            <BuildLink />
            <PocFooter />
            <EvidenceDrawer
              evidence={evidence}
              email={email}
              onSignedIn={setEmail}
              onClose={closeEvidence}
              onChanged={refreshEvidence}
            />
          </div>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
