import { bucketLabels } from "../api.ts";
import { Button } from "./ui/button.tsx";

export function MetricCards({
  metrics,
  active,
  onSelect,
}: {
  metrics: Record<string, number>;
  active: string;
  onSelect: (key: string) => void;
}): React.ReactElement {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Work queues">
      {Object.entries(bucketLabels).map(([key, label]) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          aria-pressed={active === key}
          className={`h-auto flex-col items-start gap-1 bg-card px-4 py-3 text-left shadow-(--shadow) ${active === key ? "border-2 border-primary" : ""}`}
          onClick={() => onSelect(key)}
        >
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="font-display text-3xl text-primary">{metrics[key] ?? 0}</span>
        </Button>
      ))}
    </section>
  );
}
