import {
  ControlInput,
  ControlLabel,
  ControlParagraph,
} from '@arcanewizards/sigil/frontend/controls';

import { FC, useCallback, useState } from 'react';
import { STRINGS } from '../../constants';
import { cnd } from '@arcanewizards/sigil/frontend/styling';
import { displayMillis } from '../util';
import { cn } from '@arcanejs/toolkit-frontend/util';

type DelayConfigProps = {
  delayMs: number | undefined;
  commitChanges: () => void;
  updateDelay: (delayMs: number | undefined) => void;
};

const PLACEHOLDER = `e.g: ${displayMillis(600_000)}`;

const NUMBER_REGEX = /^\d+$/;

const parseTimecode = (value: string): number | null => {
  value = value.trim();
  if (value.length === 0) {
    return 0;
  }
  const isNegative = value.startsWith('-');
  const normalizedValue = isNegative ? value.slice(1) : value;
  const parts = normalizedValue.split(':').map((part) => part.trim());
  if (parts.length === 0 || parts.length > 4) {
    return null;
  }

  const partNumbers = parts.map((part) =>
    NUMBER_REGEX.test(part) ? parseInt(part) : NaN,
  );
  if (partNumbers.some((num) => isNaN(num))) {
    return null;
  }

  const hours = partNumbers.length === 4 ? partNumbers[0]! : 0;
  const minutes =
    partNumbers.length >= 3 ? partNumbers[partNumbers.length - 3]! : 0;
  const seconds =
    partNumbers.length >= 2 ? partNumbers[partNumbers.length - 2]! : 0;
  const millis = partNumbers[partNumbers.length - 1]!;

  const totalMillis = ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
  return isNegative ? -totalMillis : totalMillis;
};

export const DelayConfig: FC<DelayConfigProps> = ({
  delayMs,
  commitChanges,
  updateDelay,
}) => {
  const [hasError, setHasError] = useState(false);

  const handleChange = useCallback(
    (value: string, enterPressed: boolean) => {
      const parsed = parseTimecode(value);
      if (parsed === null) {
        setHasError(true);
        return;
      }
      setHasError(false);
      updateDelay(-parsed);
      if (enterPressed) {
        commitChanges();
      }
    },
    [updateDelay, commitChanges],
  );

  return (
    <>
      <ControlLabel>
        <span
          className={cn(
            cnd(delayMs && delayMs < 0, 'line-through opacity-50', 'font-bold'),
          )}
        >
          {STRINGS.delay.delayLabel}
        </span>
        {' / '}
        <span
          className={cn(
            cnd(delayMs && delayMs > 0, 'line-through opacity-50', 'font-bold'),
          )}
        >
          {STRINGS.delay.offsetLabel}
        </span>
      </ControlLabel>
      <ControlInput
        position="both"
        type="string"
        value={delayMs ? displayMillis(-delayMs) : ''}
        placeholder={PLACEHOLDER}
        onChange={handleChange}
        hasError={hasError}
      />
      <ControlParagraph position="both">
        {STRINGS.delay.delayDescription}
      </ControlParagraph>
    </>
  );
};
