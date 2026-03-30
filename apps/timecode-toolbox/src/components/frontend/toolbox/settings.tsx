import { FC } from 'react';

import { AppearanceSwitcher } from '@arcanewizards/sigil/frontend/appearance';
import { useBrowserPreferences } from './preferences';
import {
  ControlButton,
  ControlLabel,
} from '@arcanewizards/sigil/frontend/controls';
import {
  ToolbarDivider,
  ToolbarRow,
  ToolbarWrapper,
} from '@arcanewizards/sigil/frontend/toolbars';
import { STRINGS } from '../constants';

type SettingsProps = {
  setWindowMode: (mode: null) => void;
};

export const Settings: FC<SettingsProps> = ({ setWindowMode }) => {
  const { preferences, updateBrowserPrefs } = useBrowserPreferences();

  return (
    <div className="flex grow flex-col">
      <ToolbarWrapper>
        <ToolbarRow>
          <span className="grow p-1">{STRINGS.settings.title}</span>
          <ToolbarDivider />
          <ControlButton
            onClick={() => setWindowMode(null)}
            variant="titlebar"
            icon="close"
            title={STRINGS.close(STRINGS.settings.title)}
          />
        </ToolbarRow>
      </ToolbarWrapper>
      <div
        className="
          grow basis-0 overflow-y-auto bg-sigil-bg-light scrollbar-sigil
        "
      >
        <div className="control-grid-large">
          <ControlLabel>Appearance</ControlLabel>
          <AppearanceSwitcher
            color={preferences.color}
            onColorChange={(color) =>
              updateBrowserPrefs((current) => ({ ...current, color }))
            }
          />
        </div>
      </div>
    </div>
  );
};
