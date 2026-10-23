import * as React from 'react'
import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const Dialog = Primitive.Root
const DialogTitle = Primitive.Title
const DialogDescription = Primitive.Description
const DialogClose = Primitive.Close
const DialogContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, children, ...props }, ref) => <Primitive.Portal><Primitive.Overlay className="dialog-overlay" /><Primitive.Content ref={ref} className={cn('dialog-content', className)} {...props}>{children}<Primitive.Close className="dialog-x"><X size={17} /></Primitive.Close></Primitive.Content></Primitive.Portal>)
DialogContent.displayName = 'DialogContent'
export { Dialog, DialogTitle, DialogDescription, DialogContent, DialogClose }
