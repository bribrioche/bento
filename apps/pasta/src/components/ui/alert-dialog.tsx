import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;

export function AlertDialogContent({ children, ...props }: AlertDialogPrimitive.AlertDialogContentProps) {
  return <AlertDialogPrimitive.Portal><AlertDialogPrimitive.Overlay className="dialog-overlay" /><AlertDialogPrimitive.Content className="dialog-content alert-content" {...props}>{children}</AlertDialogPrimitive.Content></AlertDialogPrimitive.Portal>;
}
export function AlertDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <div className="dialog-header" {...props} />; }
export function AlertDialogFooter(props: React.HTMLAttributes<HTMLDivElement>) { return <div className="dialog-footer" {...props} />; }
export function AlertDialogTitle(props: AlertDialogPrimitive.AlertDialogTitleProps) { return <AlertDialogPrimitive.Title className="dialog-title" {...props} />; }
export function AlertDialogDescription(props: AlertDialogPrimitive.AlertDialogDescriptionProps) { return <AlertDialogPrimitive.Description className="dialog-description" {...props} />; }
