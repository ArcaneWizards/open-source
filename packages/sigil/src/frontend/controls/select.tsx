import { Select } from 'radix-ui';
import { ReactNode, useCallback } from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import {
  clsControlButton,
  controlButtonColorVariables,
  ControlButtonVariant,
} from './buttons';
import { SigilColor, sigilColorUsage } from '../styling';
import { ControlPosition } from './utils';
import { TooltipWrapper } from '../tooltip';

export type SelectOption<T> = {
  label: string;
  value: T;
  /**
   * Set to true to indicate that when selected,
   * the select should look active.
   */
  active?: boolean;
};

type SelectProps<T extends string | null, O extends SelectOption<T>> = {
  options: O[];
  value: T | '';
  onChange: (value: T) => void;
  triggerText?: (option: O) => ReactNode;
  triggerButton?: (option: null | O) => ReactNode;
  option?: (option: O) => ReactNode;
  variant: ControlButtonVariant;
  position?: ControlPosition;
  disabled?: boolean;
  tooltip?: string;
  placeholder?: ReactNode;
  triggerClassName?: string;
};

const NULL_VALUE = '__null_value__';

export const ControlSelect = <
  T extends string | null,
  O extends SelectOption<T> = SelectOption<T>,
>({
  options,
  value,
  onChange,
  triggerText,
  triggerButton,
  option,
  variant,
  position,
  disabled,
  tooltip,
  placeholder,
  triggerClassName: className,
}: SelectProps<T, O>) => {
  const selectedOption = options.find((option) => option.value === value);

  const onValueChange = useCallback(
    (val: string) => {
      const matchingOption = options.find(
        (option) => (option.value ?? NULL_VALUE) === val,
      );
      if (matchingOption) {
        onChange(matchingOption.value);
      }
    },
    [options, onChange],
  );

  const t = triggerButton ? (
    triggerButton(selectedOption ?? null)
  ) : (
    <Select.Trigger
      disabled={disabled}
      className={cn(
        clsControlButton({
          variant,
          position,
          active: selectedOption?.active,
        }),
        className,
      )}
    >
      <Select.Value placeholder={placeholder}>
        {selectedOption
          ? (triggerText?.(selectedOption) ?? selectedOption.label)
          : 'Unknown'}
      </Select.Value>
    </Select.Trigger>
  );

  return (
    <Select.Root
      value={value ?? NULL_VALUE}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      {tooltip ? <TooltipWrapper tooltip={tooltip}>{t}</TooltipWrapper> : t}
      <Select.Content
        className={cn(
          `
            z-sigil-select-content rounded-sigil-control border
            border-sigil-border bg-sigil-bg-dark shadow-sigil-box
          `,
        )}
      >
        <Select.ScrollUpButton className="text-center">
          <Icon icon="arrow_drop_up" />
        </Select.ScrollUpButton>
        <Select.Viewport className="p-1">
          {options.map((o) => (
            <Select.Item
              className="
                mx-0 my-0.6 cursor-pointer rounded-[2px] px-1.5 py-0.6
                outline-none
                data-highlighted:bg-sigil-border
                data-highlighted:text-sigil-foreground-highlight
                data-[state='checked']:text-sigil-usage-hint-foreground
              "
              key={o.value ?? NULL_VALUE}
              value={o.value ?? NULL_VALUE}
            >
              <Select.ItemText>{option?.(o) ?? o.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
        <Select.ScrollDownButton className="text-center">
          <Icon icon="arrow_drop_down" />
        </Select.ScrollDownButton>
      </Select.Content>
    </Select.Root>
  );
};

type SigilOptionWithColor<T> = SelectOption<T> & { color: SigilColor };

type ControlColoredSelectProps<
  T extends string | null,
  O extends SigilOptionWithColor<T>,
> = SelectProps<T, O>;

export const ControlColoredSelect = <
  T extends string | null,
  O extends SigilOptionWithColor<T> = SigilOptionWithColor<T>,
>({
  options,
  value,
  onChange,
  variant,
  position,
  disabled,
  placeholder,
  ...props
}: ControlColoredSelectProps<T, O>) => {
  const selectedOption = options.find((option) => option.value === value);
  const selectedColor = sigilColorUsage(selectedOption?.color ?? 'gray');

  return (
    <ControlSelect
      options={options}
      value={value}
      onChange={onChange}
      triggerButton={(option) => (
        <Select.Trigger
          disabled={disabled}
          className={clsControlButton({
            variant,
            position,
            active: option?.active,
          })}
          style={controlButtonColorVariables({
            bg: selectedColor.background,
            bgHover: selectedColor.selectedBackground,
            bgActive: selectedColor.selectedBackground,
            fg: selectedColor.text,
            fgHover: selectedColor.selectedText,
            fgActive: selectedColor.selectedText,
            border: selectedColor.border,
            borderHover: selectedColor.selectedBorder,
            borderActive: selectedColor.selectedBorder,
          })}
        >
          <Select.Value
            placeholder={
              <>
                {placeholder}
                <Icon
                  className="
                    -my-text-1 -mr-text-0.5 -ml-text-0.25 text-arcane-normal
                  "
                  icon="arrow_drop_down"
                />
              </>
            }
          >
            {option?.label ?? placeholder}
            <Icon
              className="
                -my-text-1 -mr-text-0.5 -ml-text-0.25 text-arcane-normal
              "
              icon="arrow_drop_down"
            />
          </Select.Value>
        </Select.Trigger>
      )}
      option={(option) => (
        <span
          className=""
          style={{
            color: `var(--sigil-usage-${option.color}-foreground)`,
          }}
        >
          {option.label}
        </span>
      )}
      variant={variant}
      position={position}
      disabled={disabled}
      {...props}
    />
  );
};

type ControlColorSelectProps = {
  color: SigilColor | '';
} & Omit<
  ControlColoredSelectProps<SigilColor, SigilOptionWithColor<SigilColor>>,
  'value' | 'options'
>;

const COLOR_OPTIONS: Record<SigilColor, SigilOptionWithColor<SigilColor>> = {
  red: { label: 'Red', value: 'red', color: 'red' },
  blue: { label: 'Blue', value: 'blue', color: 'blue' },
  teal: { label: 'Teal', value: 'teal', color: 'teal' },
  green: { label: 'Green', value: 'green', color: 'green' },
  yellow: { label: 'Yellow', value: 'yellow', color: 'yellow' },
  purple: { label: 'Purple', value: 'purple', color: 'purple' },
  orange: { label: 'Orange', value: 'orange', color: 'orange' },
  brown: { label: 'Brown', value: 'brown', color: 'brown' },
  gray: { label: 'Gray', value: 'gray', color: 'gray' },
};

const COLOR_OPTIONS_ARRAY = Object.values(COLOR_OPTIONS);

export const ControlColorSelect = ({
  color,
  ...props
}: ControlColorSelectProps) => {
  return (
    <ControlColoredSelect
      options={COLOR_OPTIONS_ARRAY}
      value={color}
      {...props}
    />
  );
};
