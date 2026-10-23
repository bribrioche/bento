import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export function DropdownMenuContent({ className, ...props }: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content sideOffset={6} align="end" className={cn("dropdown-content", className)} {...props} /></DropdownMenuPrimitive.Portal>;
}
export function DropdownMenuItem({ className, ...props }: DropdownMenuPrimitive.DropdownMenuItemProps) {
  return <DropdownMenuPrimitive.Item className={cn("dropdown-item", className)} {...props} />;
}
