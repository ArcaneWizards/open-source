import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';

type DivProps = ComponentPropsWithoutRef<'div'>;

export const ToolbarWrapper = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn(
        'z-sigil-toolbar w-full bg-sigil-bg-dark shadow-sigil-box',
        className,
      )}
    />
  ),
);

ToolbarWrapper.displayName = 'ToolbarWrapper';

export const ToolbarRow = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn(
        `
          flex items-center gap-sigil-toolbar-gap border-b border-sigil-border
          p-sigil-toolbar-gap
        `,
        className,
      )}
    />
  ),
);

ToolbarRow.displayName = 'ToolbarRow';

export const ToolbarRowTall = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <ToolbarRow
      {...props}
      ref={ref}
      className={cn('px-sigil-toolbar-gap py-sigil-toolbar-padding', className)}
    />
  ),
);

ToolbarRowTall.displayName = 'ToolbarRowTall';

export const ToolbarSegment = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn('flex grow basis-0 items-center', className)}
    />
  ),
);

ToolbarSegment.displayName = 'ToolbarSegment';

export const ToolbarDivider = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn(
        'relative h-sigil-toolbar-divider w-px bg-sigil-border',
        className,
      )}
    />
  ),
);

ToolbarDivider.displayName = 'ToolbarDivider';

export const ToolbarSpacer = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <ToolbarDivider
      {...props}
      ref={ref}
      className={cn('mx-sigil-toolbar-gap', className)}
    />
  ),
);

ToolbarSpacer.displayName = 'ToolbarSpacer';

export const ToolbarGrow = forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn('flex grow items-center gap-sigil-toolbar-gap', className)}
    />
  ),
);

ToolbarGrow.displayName = 'ToolbarGrow';
