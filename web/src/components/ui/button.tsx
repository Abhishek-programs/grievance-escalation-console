import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.ts";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-xs font-medium whitespace-nowrap transition-[background,transform,border-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground hover:border-(--action-hover) hover:bg-(--action-hover)",
        secondary: "border border-border bg-transparent text-foreground hover:bg-secondary",
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
        ghost: "hover:bg-accent",
        destructive: "border border-transparent bg-(--red-bg) text-(--red) hover:opacity-90",
      },
      size: {
        default: "min-h-[46px] px-[21px] py-[13px]",
        sm: "min-h-9 px-3.5",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
