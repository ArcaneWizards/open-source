import { FC, useContext } from 'react';

import { AppearanceSwitcher } from '@arcanewizards/sigil/frontend/appearance';
import { useBrowserPreferences } from './preferences';
import {
  ControlButton,
  ControlDetails,
  ControlLabel,
  ControlSelect,
  SelectOption,
} from '@arcanewizards/sigil/frontend/controls';
import {
  ToolbarDivider,
  ToolbarRow,
  ToolbarWrapper,
} from '@arcanewizards/sigil/frontend/toolbars';
import { STRINGS } from '../constants';
import { ConfigContext, useApplicationState } from './context';

type SettingsProps = {
  setWindowMode: (mode: null) => void;
};

const ENABLED_DISABLED_OPTIONS: SelectOption<'enabled' | 'disabled'>[] = [
  { value: 'enabled', label: STRINGS.general.enabled },
  { value: 'disabled', label: STRINGS.general.disabled },
];

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'medium',
});

export const Settings: FC<SettingsProps> = ({ setWindowMode }) => {
  const { preferences, updateBrowserPrefs } = useBrowserPreferences();
  const { config, updateConfig } = useContext(ConfigContext);
  const { updates } = useApplicationState();

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
          <ControlLabel>{STRINGS.updates.settingsLabel}</ControlLabel>
          <ControlSelect
            value={config.checkForUpdates ? 'enabled' : 'disabled'}
            options={ENABLED_DISABLED_OPTIONS}
            onChange={(value) =>
              updateConfig((current) => ({
                ...current,
                checkForUpdates: value === 'enabled',
              }))
            }
            variant="large"
          />
          <ControlDetails>{STRINGS.updates.settingsDetails}</ControlDetails>
          {updates && 'lastCheckedMillis' in updates && (
            <ControlDetails>
              {STRINGS.updates.lastChecked(
                DATE_FORMATTER.format(updates.lastCheckedMillis),
              )}
            </ControlDetails>
          )}
        </div>
      </div>
    </div>
  );
};
