import * as Primitive from '@radix-ui/react-alert-dialog'
export const AlertDialog = Primitive.Root
export const AlertDialogTrigger = Primitive.Trigger
export const AlertDialogTitle = Primitive.Title
export const AlertDialogDescription = Primitive.Description
export const AlertDialogCancel = Primitive.Cancel
export const AlertDialogAction = Primitive.Action
export function AlertDialogContent({ children }: { children: React.ReactNode }) {
  return <Primitive.Portal><Primitive.Overlay className="dialog-overlay" /><Primitive.Content className="dialog-content alert-dialog-content">{children}</Primitive.Content></Primitive.Portal>
}
