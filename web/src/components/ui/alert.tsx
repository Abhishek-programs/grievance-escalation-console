import { cn } from "../../lib/utils.ts";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive", className)}
      {...props}
    />
  );
}
