import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content className={cn("dialog-content", className)} {...props}>
        {children}
        <DialogPrimitive.Close className="dialog-close" aria-label="Close"><X size={17} /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <div className="dialog-header" {...props} />; }
export function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>) { return <div className="dialog-footer" {...props} />; }
export function DialogTitle(props: DialogPrimitive.DialogTitleProps) { return <DialogPrimitive.Title className="dialog-title" {...props} />; }
export function DialogDescription(props: DialogPrimitive.DialogDescriptionProps) { return <DialogPrimitive.Description className="dialog-description" {...props} />; }
