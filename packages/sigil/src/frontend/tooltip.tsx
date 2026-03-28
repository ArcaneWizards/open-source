import { Tooltip } from 'radix-ui';
import {
  ComponentPropsWithoutRef,
  ElementRef,
  createContext,
  FC,
  forwardRef,
  ReactNode,
  useContext,
  useState,
} from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { KeyboardBinding, RegisteredBinding } from './input';

const Content = forwardRef<
  ElementRef<typeof Tooltip.Content>,
  ComponentPropsWithoutRef<typeof Tooltip.Content>
>(({ className, ...props }, ref) => (
  <Tooltip.Content
    {...props}
    ref={ref}
    className={cn(
      `
        relative z-sigil-tooltip rounded-sigil-control
        bg-sigil-usage-hint-background px-1 py-0.5 leading-[1.5]
        text-sigil-usage-hint-text shadow-sigil-box
      `,
      className,
    )}
  />
));

Content.displayName = 'Content';

const Arrow = forwardRef<
  ElementRef<typeof Tooltip.Arrow>,
  ComponentPropsWithoutRef<typeof Tooltip.Arrow>
>(({ className, ...props }, ref) => (
  <Tooltip.Arrow
    {...props}
    ref={ref}
    className={cn(
      'fill-sigil-usage-hint-background drop-shadow-sigil-tooltip-arrow',
      className,
    )}
  />
));

Arrow.displayName = 'Arrow';

const TooltipBoundaryContext = createContext<HTMLElement | null>(null);

export type TooltipBoundaryProps = ComponentPropsWithoutRef<'div'>;

export const TooltipBoundary: FC<TooltipBoundaryProps> = ({
  children,
  ...props
}) => {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  return (
    <TooltipBoundaryContext.Provider
      value={ref ? (ref as unknown as HTMLElement) : null}
    >
      <div ref={setRef} {...props}>
        {children}
      </div>
    </TooltipBoundaryContext.Provider>
  );
};

export type TooltipProps = {
  tooltip: string | ReactNode | null;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

export const TooltipWrapper: FC<TooltipProps> = ({
  tooltip,
  children,
  side = 'top',
}) => {
  const boundary = useContext(TooltipBoundaryContext);
  if (!tooltip) {
    return children;
  }
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Content
        side={side}
        align="center"
        sideOffset={5}
        alignOffset={0}
        collisionBoundary={boundary ? [boundary] : []}
        collisionPadding={10}
      >
        <Arrow />
        {tooltip}
      </Content>
    </Tooltip.Root>
  );
};

const keyboardShortcutText = (binding: KeyboardBinding): string => {
  const parts: string[] = [];
  if (binding.modifiers?.ctrlOrMetaKey) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (binding.modifiers?.shiftKey) {
    parts.push('Shift');
  }
  if (binding.key === 'ArrowLeft') {
    parts.push('Left Arrow');
  } else if (binding.key === 'ArrowRight') {
    parts.push('Right Arrow');
  } else if (binding.key === ' ') {
    parts.push('Space');
  } else {
    parts.push(binding.key.toUpperCase());
  }
  return parts.join(' + ');
};

export const keyboardShortcutTooltip = (
  label: ReactNode,
  keyboardBinding?: RegisteredBinding,
  extraBindings?: KeyboardBinding[],
) => {
  const bindings: KeyboardBinding[] = [
    ...(keyboardBinding ? [keyboardBinding[0]] : []),
    ...(extraBindings ?? []),
  ];
  if (bindings.length === 0) {
    return label;
  }
  return (
    <>
      {label}
      <kbd
        className="text-[0.8rem] opacity-60"
        style={{ fontFamily: 'sans-serif' }}
      >
        {` (${bindings.map(keyboardShortcutText).join(' / ')})`}
      </kbd>
    </>
  );
};
