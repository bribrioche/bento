import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn('modal-backdrop', className)} {...props} />
))
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({ className, children, ...props }, ref) => (
  <DialogPortal><DialogOverlay /><DialogPrimitive.Content ref={ref} className={cn('modal', className)} {...props}>{children}<DialogPrimitive.Close className="icon-button modal-close" aria-label="Close"><X size={18} /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPortal>
))
DialogContent.displayName = 'DialogContent'

const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription }
