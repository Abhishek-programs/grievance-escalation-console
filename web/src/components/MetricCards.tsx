import { bucketLabels } from "../api.ts";

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
    <section className="metrics" aria-label="Work queues">
      {Object.entries(bucketLabels).map(([key, label]) => (
        <button
          className={active === key ? "metric active" : "metric"}
          key={key}
          type="button"
          aria-pressed={active === key}
          onClick={() => onSelect(key)}
        >
          <span>{label}</span>
          <strong>{metrics[key] ?? 0}</strong>
        </button>
      ))}
    </section>
  );
}
