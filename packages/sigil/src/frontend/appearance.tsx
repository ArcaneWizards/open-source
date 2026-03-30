import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { ControlButton, ControlColorSelect } from './controls';
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
      <ControlButton
        onClick={selectDarkMode}
        active={colorSchemePreference === 'dark'}
        title="Switch to Dark Mode"
        variant="large"
      >
        <Icon icon="dark_mode" className="text-[1.5rem]" />
        <span>Dark</span>
      </ControlButton>
      <ControlButton
        onClick={selectLightMode}
        active={colorSchemePreference === 'light'}
        title="Switch to Light Mode"
        variant="large"
      >
        <Icon icon="light_mode" className="text-[1.5rem]" />
        <span>Light</span>
      </ControlButton>
      <ControlButton
        onClick={selectSystemMode}
        active={colorSchemePreference === 'auto'}
        title="Switch to System Mode"
        variant="large"
      >
        <Icon icon="contrast" className="text-[1.5rem]" />
        <span>Auto / System</span>
      </ControlButton>
      <ControlColorSelect
        color={color}
        onChange={updateHintColor}
        variant="large"
      />
    </div>
  );
};
