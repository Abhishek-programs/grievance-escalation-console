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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Work queues">
      {Object.entries(bucketLabels).map(([key, label]) => (
        <Button
          key={key}
          type="button"
          variant={active === key ? "default" : "outline"}
          aria-pressed={active === key}
          className="h-auto flex-col items-start gap-2 px-4 py-3"
          onClick={() => onSelect(key)}
        >
          <span className={active === key ? "text-primary-foreground/80" : "text-muted-foreground"}>
            {label}
          </span>
          <span className="text-3xl font-semibold">{metrics[key] ?? 0}</span>
        </Button>
      ))}
    </section>
  );
}
