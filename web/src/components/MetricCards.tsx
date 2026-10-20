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
    <nav
      className="flex flex-wrap items-center gap-x-7 gap-y-1 rounded-full bg-secondary px-5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_2%,transparent)]"
      aria-label="Work queues"
    >
      {Object.entries(bucketLabels).map(([key, label]) => {
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            className={`relative min-h-[52px] text-[11px] font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => onSelect(key)}
          >
            {label}
            <span className="ml-2 font-normal text-(--link) tabular-nums">{metrics[key] ?? 0}</span>
            <span
              className={`absolute bottom-2.5 left-0 h-px w-full origin-left bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${selected ? "scale-x-100" : "scale-x-0"}`}
            />
          </button>
        );
      })}
    </nav>
  );
}
