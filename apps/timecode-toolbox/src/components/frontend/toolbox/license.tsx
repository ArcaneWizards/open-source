import { FC } from 'react';

import { ControlButton } from '@arcanewizards/sigil/frontend/controls';

import { STRINGS } from '../constants';
import { TimecodeToolboxLogo } from './logo';

type LicenseProps = {
  license: string;
  setWindowMode: (mode: null) => void;
};

export const LicenseContent: FC<{ license: string }> = ({ license }) => {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-sigil-bg-light p-2">
      {license.split('\n\n').map((paragraph, index) => (
        <p className="m-0" key={index}>
          {paragraph.replace(/\n/g, ' ').trim()}
        </p>
      ))}
    </div>
  );
};

export const License: FC<LicenseProps> = ({ license, setWindowMode }) => {
  return (
    <div className="flex grow flex-col">
      <div
        className="
          flex grow basis-0 flex-col overflow-y-auto px-2 pb-2 scrollbar-sigil
        "
      >
        <TimecodeToolboxLogo
          className="
          h-[20%] max-h-[420px] min-h-[110px] w-full
        "
        />
        <LicenseContent license={license} />
        <div className="flex justify-center p-2">
          <ControlButton
            onClick={() => setWindowMode(null)}
            variant="large"
            icon="close"
          >
            {STRINGS.close(STRINGS.license)}
          </ControlButton>
        </div>
      </div>
    </div>
  );
};
