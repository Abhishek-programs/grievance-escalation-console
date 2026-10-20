import { cn } from "../../lib/utils.ts";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-[17px] border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-card text-card-foreground shadow-(--shadow)", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 px-7 pt-7", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-[1.35rem] leading-none font-semibold tracking-[-0.04em]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-7 pt-4 pb-7", className)} {...props} />;
}
