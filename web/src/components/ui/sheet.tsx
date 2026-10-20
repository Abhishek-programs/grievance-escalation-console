import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.ts";

export function Sheet(props: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}
export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col gap-4 overflow-y-auto border-l bg-card p-6 shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof Dialog.Title>) {
  return <Dialog.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof Dialog.Description>) {
  return <Dialog.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
