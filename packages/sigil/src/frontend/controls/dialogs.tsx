import { FC, forwardRef } from 'react';
import { Dialog, DialogProps } from '../dialogs';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { cnd } from '../styling';
import { clsControlPosition } from './utils';

export const ControlDialogButtons = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      `
        flex items-stretch gap-1
        [&>button]:grow
      `,
      clsControlPosition('row'),
      className,
    )}
    {...props}
  >
    {children}
  </div>
));

type ControlDialogProps = Omit<DialogProps, 'variant'> & {
  large?: boolean;
};

export const ControlDialog: FC<ControlDialogProps> = ({
  children,
  large,
  ...props
}) => (
  <Dialog {...props} variant="dark">
    <div
      className={cn(
        'gap-1 bg-sigil-bg-dark select-none',
        cnd(large, 'control-grid-large', 'control-grid'),
      )}
    >
      {children}
    </div>
  </Dialog>
);
