import { FC, ReactNode } from 'react';

type PrimaryToolboxSectionProps = {
  title: string;
  children: ReactNode;
  buttons: ReactNode;
};

export const PrimaryToolboxSection: FC<PrimaryToolboxSectionProps> = ({
  title,
  children,
  buttons,
}) => {
  return (
    <div className="flex grow gap-px">
      <div
        className="
          flex items-center justify-center bg-sigil-bg-light p-1
          writing-mode-vertical-rl
        "
      >
        {title}
      </div>
      <div className="flex grow flex-col gap-px">
        <div className="flex grow flex-col gap-px">{children}</div>
        <div className="flex w-full flex-wrap gap-1 bg-sigil-bg-light p-1">
          {buttons}
        </div>
      </div>
    </div>
  );
};
/**
 * Display the given number of milliseconds in a nice format to the user
 */
export function displayMillis(totalMilliseconds: number): string {
  if (totalMilliseconds < 0) {
    return '-' + displayMillis(-totalMilliseconds);
  }
  let remaining = totalMilliseconds;
  const hours = (remaining / 3600000) | 0;
  remaining -= hours * 3600000;
  const mins = (remaining / 60000) | 0;
  remaining -= mins * 60000;
  const seconds = (remaining / 1000) | 0;
  remaining -= seconds * 1000;
  const millis = remaining | 0;
  return (
    (hours < 10 ? '0' : '') +
    hours +
    ':' +
    (mins < 10 ? '0' : '') +
    mins +
    ':' +
    (seconds < 10 ? '0' : '') +
    seconds +
    ':' +
    (millis < 10 ? '00' : millis < 100 ? '0' : '') +
    millis
  );
}
