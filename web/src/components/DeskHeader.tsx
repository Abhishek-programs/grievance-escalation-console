import { ThemeToggle } from "./ThemeToggle.tsx";

export function DeskHeader({
  health,
  email,
  browser = false,
  dark,
  onToggleTheme,
  onSignOut,
}: {
  health: boolean | null;
  email: string | null;
  browser?: boolean;
  dark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const database =
    health === null
      ? "Checking the database…"
      : health
        ? "Database connected"
        : "Database not connected";
  return (
    <header>
      <div className="border-b border-border">
        <div className="mx-auto flex min-h-11 w-[min(1328px,calc(100%-2.5rem))] items-center justify-between gap-4">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Proof of concept
          </p>
          <div className="flex items-center gap-4">
            {email ? (
              <>
                <p className="text-[11px] text-muted-foreground">{email}</p>
                <button
                  type="button"
                  className="text-[11px] text-(--link)"
                  onClick={onSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {browser ? "Saved in this browser" : "Checking sign-in…"}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">{database}</p>
            <ThemeToggle dark={dark} onToggle={onToggleTheme} />
          </div>
        </div>
      </div>
      <div className="mx-auto w-[min(1328px,calc(100%-2.5rem))] py-8">
        <h1 className="max-w-3xl text-[clamp(36px,3.7vw,54px)]">
          Grievance desk
        </h1>
        <p className="mt-4 max-w-[690px] text-sm leading-[1.9] text-muted-foreground">
          {browser
            ? "The sample complaints are already in this browser. Import another file, check a deadline, or record a decision. None of that is written to the database."
            : "Import a complaint, check it against the deadline, and see who should receive it. The cases are fictional. This desk is a portfolio piece."}
        </p>
      </div>
    </header>
  );
}
