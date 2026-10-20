import { ThemeToggle } from "./ThemeToggle.tsx";

export function DeskHeader({
  summary,
  health,
  dark,
  onToggleTheme,
}: {
  summary: string;
  health: boolean | null;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const database =
    health === null ? "Checking the database…" : health ? "Database connected" : "Database not connected";
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Proof of concept</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Grievance desk</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">{database}</p>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
