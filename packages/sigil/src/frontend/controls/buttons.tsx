import {
  ComponentPropsWithoutRef,
  CSSProperties,
  forwardRef,
  type ReactNode,
} from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { cnd, cssVariables } from '../styling';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { TooltipWrapper, type TooltipProps } from '../tooltip';
import {
  useLongPressable,
  usePressable,
  type PressableOnClickListener,
} from '../input';
import { clsControlPosition, type ControlPosition } from './utils';

const CONTROL_BUTTON_VAR_SUFFIX = {
  bg: 'bg',
  bgHover: 'bg-hover',
  bgActive: 'bg-active',
  fg: 'fg',
  fgHover: 'fg-hover',
  fgActive: 'fg-active',
  border: 'border',
  borderHover: 'border-hover',
  borderActive: 'border-active',
} as const;

export const controlButtonColorVariable = (
  property: keyof typeof CONTROL_BUTTON_VAR_SUFFIX,
) => `--sigil-control-button-${CONTROL_BUTTON_VAR_SUFFIX[property]}`;

export const controlButtonColorVariables = (
  usage: Record<keyof typeof CONTROL_BUTTON_VAR_SUFFIX, string>,
): CSSProperties =>
  cssVariables(
    Object.fromEntries(
      (Object.keys(usage) as (keyof typeof CONTROL_BUTTON_VAR_SUFFIX)[]).map(
        (key) => [controlButtonColorVariable(key), usage[key]],
      ),
    ),
  );

export type ControlButtonVariant =
  | 'standard'
  | 'border'
  | 'large'
  | 'table-row'
  | 'toolbar'
  | 'titlebar'
  | 'properties';

export type ControlButtonProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'onClick' | 'title'
> & {
  onClick: PressableOnClickListener;
  variant: ControlButtonVariant;
  active?: boolean;
  title?: ReactNode;
  tooltipSide?: TooltipProps['side'];
  position?: ControlPosition;
} & (
    | { children: ReactNode; icon?: string }
    | { children?: undefined; icon: string }
  );

type ControlButtonFrameProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'title'
> & {
  children?: ReactNode;
  icon?: string;
  variant?: ControlButtonVariant;
  active?: boolean;
  touching?: boolean;
  title?: ReactNode;
  tooltipSide?: TooltipProps['side'];
  position?: ControlPosition;
};

export const clsControlButton = ({
  variant,
  active,
  touching,
  position,
  className,
}: Pick<
  ControlButtonFrameProps,
  'variant' | 'active' | 'touching' | 'position' | 'className'
>) =>
  cn(
    `sigil-control-button`,
    cnd(variant === 'border', `sigil-control-button-variant-border`),
    cnd(variant === 'large', `sigil-control-button-variant-large`),
    cnd(variant === 'properties', `sigil-control-button-variant-properties`),
    cnd(variant === 'table-row', `sigil-control-button-variant-table-row`),
    cnd(variant === 'toolbar', `sigil-control-button-variant-toolbar`),
    cnd(variant === 'titlebar', `sigil-control-button-variant-titlebar`),
    cnd(touching, `sigil-control-button-touching`),
    cnd(active, `sigil-control-button-active`),
    cnd(touching && active, `sigil-control-button-active-touching`),
    clsControlPosition(position),
    className,
  );

const ControlButtonFrame = forwardRef<
  HTMLButtonElement,
  ControlButtonFrameProps
>(
  (
    {
      children,
      className,
      type,
      variant = 'toolbar',
      icon,
      active,
      touching,
      disabled,
      title,
      tooltipSide,
      position,
      ...props
    },
    ref,
  ) => {
    const btn = (
      <button
        {...props}
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled}
        className={clsControlButton({
          variant,
          active,
          touching,
          position,
          className,
        })}
      >
        <span>
          {icon && (
            <Icon
              icon={icon}
              className={cn(cnd(children, 'text-[120%]', 'text-[150%]'))}
            />
          )}
          {children}
        </span>
      </button>
    );
    if (!title) return btn;
    return (
      <TooltipWrapper tooltip={title} side={tooltipSide}>
        {btn}
      </TooltipWrapper>
    );
  },
);

ControlButtonFrame.displayName = 'ControlButtonFrame';

export const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  ({ onClick, disabled, ...props }, ref) => {
    const { handlers, touching } = usePressable(onClick);

    return (
      <ControlButtonFrame
        {...props}
        ref={ref}
        disabled={disabled}
        touching={touching}
        {...(!disabled ? handlers : {})}
      />
    );
  },
);

ControlButton.displayName = 'ControlButton';

export type CheckboxControlButtonProps = Omit<
  ControlButtonProps,
  'children' | 'icon'
> & {
  label?: string;
};

export const CheckboxControlButton = forwardRef<
  HTMLButtonElement,
  CheckboxControlButtonProps
>(({ active, label, ...props }, ref) => (
  <ControlButton {...props} ref={ref} active={active}>
    <Icon icon={active ? 'check_box' : 'check_box_outline_blank'} />
    {label}
  </ControlButton>
));

CheckboxControlButton.displayName = 'CheckboxControlButton';

export type LongPressableControlButtonProps = Omit<
  ControlButtonFrameProps,
  'icon' | 'onClick' | 'touching'
> & {
  children: ReactNode;
  onPress: () => void;
  onRelease: () => void;
};

export const LongPressableControlButton = forwardRef<
  HTMLButtonElement,
  LongPressableControlButtonProps
>(({ active, disabled, onPress, onRelease, ...props }, ref) => {
  const { handlers, touching } = useLongPressable({ onPress, onRelease });

  return (
    <ControlButtonFrame
      {...props}
      ref={ref}
      active={active || touching}
      disabled={disabled}
      {...(!disabled ? handlers : {})}
    />
  );
});

LongPressableControlButton.displayName = 'LongPressableControlButton';

export type ControlButtonGroupProps = ComponentPropsWithoutRef<'div'> & {
  position?: ControlPosition;
};

export const ControlButtonGroup = forwardRef<
  HTMLDivElement,
  ControlButtonGroupProps
>(({ children, className, position, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    className={cn(
      `
        flex items-stretch gap-sigil-control-gap
        [&>button]:grow
      `,
      clsControlPosition(position),
      className,
    )}
  >
    {children}
  </div>
));

ControlButtonGroup.displayName = 'ControlButtonGroup';
