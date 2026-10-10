import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import {
  ControlButton,
  ControlButtonGroup,
  ControlColorSelect,
} from './controls';
import { useColorSchemePreferences } from '@arcanejs/toolkit-frontend/util';
import { FC, useCallback } from 'react';
import { SigilColor } from './styling';

type AppearanceSwitcherProps = {
  color: SigilColor;
  onColorChange: (color: SigilColor) => void;
};

export const AppearanceSwitcher: FC<AppearanceSwitcherProps> = ({
  color,
  onColorChange,
}) => {
  const { colorSchemePreference, setColorSchemePreference } =
    useColorSchemePreferences();

  const selectDarkMode = useCallback(() => {
    setColorSchemePreference('dark');
  }, [setColorSchemePreference]);

  const selectLightMode = useCallback(() => {
    setColorSchemePreference('light');
  }, [setColorSchemePreference]);

  const selectSystemMode = useCallback(() => {
    setColorSchemePreference('auto');
  }, [setColorSchemePreference]);

  const updateHintColor = useCallback(
    (color: SigilColor) => {
      if (onColorChange) {
        onColorChange(color);
      }
    },
    [onColorChange],
  );

  return (
    <div className="control-grid-pos-all flex flex-wrap items-stretch gap-2">
      <ControlButtonGroup variant="large">
        <ControlButton
          onClick={selectDarkMode}
          active={colorSchemePreference === 'dark'}
          title="Switch to Dark Mode"
          variant="group"
        >
          <Icon icon="dark_mode" className="text-[1.5rem]" />
          <span>Dark</span>
        </ControlButton>
        <ControlButton
          onClick={selectLightMode}
          active={colorSchemePreference === 'light'}
          title="Switch to Light Mode"
          variant="group"
        >
          <Icon icon="light_mode" className="text-[1.5rem]" />
          <span>Light</span>
        </ControlButton>
        <ControlButton
          onClick={selectSystemMode}
          active={colorSchemePreference === 'auto'}
          title="Switch to System Mode"
          variant="group"
        >
          <Icon icon="contrast" className="text-[1.5rem]" />
          <span>Auto / System</span>
        </ControlButton>
      </ControlButtonGroup>
      <ControlColorSelect
        color={color}
        onChange={updateHintColor}
        variant="large"
      />
    </div>
  );
};
