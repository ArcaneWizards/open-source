import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { cnd } from '../styling';
import {
  clsControlPosition,
  clsControlSubgridPosition,
  ControlPosition,
} from './utils';

export type ControlParagraphMode = 'error' | 'success' | 'warning';

export type ControlParagraphProps = ComponentPropsWithoutRef<'p'> & {
  position?: ControlPosition;
  mode?: ControlParagraphMode;
};

export const ControlParagraph = forwardRef<
  HTMLParagraphElement,
  ControlParagraphProps
>(({ className, mode, position = 'all', ...props }, ref) => (
  <p
    {...props}
    ref={ref}
    className={cn(
      'border border-transparent',
      clsControlPosition(position),
      cnd(
        mode === 'success',
        `
          border-sigil-usage-green-dimmed-border
          bg-sigil-usage-green-dimmed-background p-1 text-sigil-usage-green-text
        `,
      ),
      cnd(
        mode === 'warning',
        `
          border-sigil-usage-yellow-dimmed-border
          bg-sigil-usage-yellow-dimmed-background p-1
          text-sigil-usage-yellow-text
        `,
      ),
      cnd(
        mode === 'error',
        `
          border-sigil-usage-red-dimmed-border
          bg-sigil-usage-red-dimmed-background p-1 text-sigil-usage-red-text
        `,
      ),
      className,
    )}
  />
));

ControlParagraph.displayName = 'ControlParagraph';

export type ControlLabelProps = ComponentPropsWithoutRef<'div'> & {
  subgrid?: boolean;
  position?: ControlPosition;
  disabled?: boolean;
  nonMicro?: boolean;
};

export const ControlLabel = forwardRef<HTMLDivElement, ControlLabelProps>(
  (
    { className, disabled, nonMicro, position = 'label', subgrid, ...props },
    ref,
  ) => {
    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          'flex items-center justify-end gap-0.6 p-0.6',
          clsControlPosition(position),
          cnd(nonMicro, 'max-[550px]:hidden'),
          cnd(disabled, 'opacity-50'),
          clsControlSubgridPosition(position, subgrid),
          className,
        )}
      />
    );
  },
);

ControlLabel.displayName = 'ControlLabel';

export type ControlDetailsProps = ComponentPropsWithoutRef<'div'> & {
  position?: ControlPosition;
  align?: 'start' | 'center' | 'end';
};

export const ControlDetails = forwardRef<HTMLDivElement, ControlDetailsProps>(
  ({ align, className, position = 'all', ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn(
        'flex items-center px-0.3 text-sigil-foreground-muted',
        clsControlPosition(position),
        cnd(align === 'start', 'justify-start'),
        cnd(align === 'center', 'justify-center'),
        cnd(align === 'end', 'justify-end'),
        className,
      )}
    />
  ),
);

ControlDetails.displayName = 'ControlDetails';

export type InputSpanningTitleProps = ComponentPropsWithoutRef<'div'> & {
  position?: ControlPosition;
};

export const InputSpanningTitle = forwardRef<
  HTMLDivElement,
  InputSpanningTitleProps
>(({ className, position = 'row', ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    className={cn(
      'truncate p-0.6 text-center text-[0.8rem] font-bold',
      clsControlPosition(position),
      className,
    )}
  />
));

InputSpanningTitle.displayName = 'InputSpanningTitle';
