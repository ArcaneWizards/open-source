import {
  ComponentProps,
  FC,
  FocusEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { cnd } from '../styling';
import {
  clsControlPosition,
  clsControlSubgridPosition,
  type ControlPosition,
} from './utils';

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'ref' | 'onChange'
> & {
  value: string | null;
  disabled?: boolean;
  onChange: (value: string, enterPressed: boolean) => void;
  inputRef?: MutableRefObject<HTMLInputElement | null>;
};

export const InputWithDelayedPropagation: FC<InputProps> = ({
  value,
  disabled,
  onChange,
  inputRef: inputRefProp,
  ...props
}) => {
  const lastValue = useRef<string | null>(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
    lastValue.current = value;
  }, [value]);

  const updateRef = useCallback(
    (instance: HTMLInputElement | null) => {
      inputRef.current = instance;
      if (inputRefProp) {
        inputRefProp.current = instance;
      }
    },
    [inputRefProp],
  );

  const onBlurProp = props.onBlur;
  const onBlur: InputProps['onBlur'] = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (e.currentTarget.value !== lastValue.current) {
        onChange(e.currentTarget.value, false);
      }
      onBlurProp?.(e);
    },
    [onChange, onBlurProp],
  );

  const onKeyUpProp = props.onKeyUp;
  const onKeyUp: InputProps['onKeyUp'] = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        (e.key === 'Enter' || e.key.startsWith('Arrow')) &&
        e.currentTarget.value !== lastValue.current
      ) {
        onChange(e.currentTarget.value, true);
      }
      onKeyUpProp?.(e);
    },
    [onChange, onKeyUpProp],
  );

  return (
    <input
      ref={updateRef}
      defaultValue={value}
      onBlur={onBlur}
      onKeyUp={onKeyUp}
      disabled={disabled}
      {...props}
    />
  );
};

export type ControlInputProps = ComponentProps<
  typeof InputWithDelayedPropagation
> & {
  position?: ControlPosition;
  subgrid?: boolean;
  nonMicro?: boolean;
};

export const ControlInput: FC<ControlInputProps> = ({
  className,
  nonMicro,
  position = 'first',
  subgrid,
  ...props
}) => (
  <InputWithDelayedPropagation
    {...props}
    className={cn(
      `
        overflow-hidden border-0 bg-sigil-bg-dark px-arcane-slider-input-hidden
        py-[7px] text-[0.7rem] text-sigil-foreground shadow-none
        focus:border-2 focus:border-sigil-usage-hint-foreground
        focus:bg-sigil-bg-dark-1 focus:px-[7px] focus:py-arcane-slider-input-px
        focus:text-sigil-usage-hint-foreground focus:outline-none
        disabled:opacity-50
        [&::-webkit-inner-spin-button]:opacity-20
        focus:[&::-webkit-inner-spin-button]:opacity-50
        [&::-webkit-outer-spin-button]:opacity-20
        focus:[&::-webkit-outer-spin-button]:opacity-50
      `,
      clsControlPosition(position),
      clsControlSubgridPosition(position, subgrid),
      cnd(nonMicro, 'max-[550px]:hidden'),
      className,
    )}
  />
);

export type ControlPercentProps = Omit<ControlInputProps, 'className'> & {
  className?: string;
};

export const ControlPercent: FC<ControlPercentProps> = ({
  className,
  ...props
}) => <ControlInput {...props} className={cn('min-w-[5rem]', className)} />;
