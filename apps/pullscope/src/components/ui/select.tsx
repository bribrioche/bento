import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} className={cn('select-trigger', className)} {...props}>{children}<SelectPrimitive.Icon><ChevronDown size={14} /></SelectPrimitive.Icon></SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

const SelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal><SelectPrimitive.Content ref={ref} className={cn('select-content', className)} position="popper" sideOffset={5} {...props}><SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={cn('select-item', className)} {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator><Check size={13} /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
