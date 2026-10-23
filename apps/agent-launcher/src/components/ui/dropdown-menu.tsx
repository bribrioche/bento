import * as Primitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils'

export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger

export function DropdownMenuContent({ className, ...props }: Primitive.DropdownMenuContentProps) {
  return <Primitive.Portal><Primitive.Content className={cn('dropdown-content', className)} sideOffset={6} align="end" {...props} /></Primitive.Portal>
}

export function DropdownMenuItem({ className, ...props }: Primitive.DropdownMenuItemProps) {
  return <Primitive.Item className={cn('dropdown-item', className)} {...props} />
}
