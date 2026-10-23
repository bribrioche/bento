import { Loader2 } from 'lucide-react'
import type * as React from 'react'
import { cn } from '../../lib/utils'

interface SpinnerProps extends React.ComponentProps<typeof Loader2> {
  label?: string
}

function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  return <Loader2 role="status" aria-label={label} className={cn('spinner', className)} {...props} />
}

export { Spinner }
