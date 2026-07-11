import { cn } from '@arcanejs/toolkit-frontend/util';
import * as React from 'react';
import { cnd } from './styling';

type Variants = 'default' | 'error';

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & { variant?: Variants }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        `
          relative grid w-full grid-cols-[max-content_1fr] items-start gap-y-0.5
          rounded-md border px-2 py-1.5
          has-[>_.font-arcane-icon]:gap-x-1.5
          [&>_.font-arcane-icon]:text-current
        `,
        cnd(
          variant === 'default',
          `
            text-sigil-foreground
            *:data-[slot=alert-description]:text-sigil-foreground-muted
          `,
        ),
        cnd(
          variant === 'error',
          `
            border-sigil-usage-red-border bg-sigil-usage-red-background
            text-sigil-usage-red-text
            *:data-[slot=alert-description]:text-sigil-usage-red-text/90
          `,
        ),
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4', className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(`col-start-2 grid justify-items-start gap-1`, className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
