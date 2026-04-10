import { useEffect } from 'react';
import { cssHintColorVariables, SigilColor } from './styling';

/**
 * Hook that will adjust the root hint color based on the given color.
 */
export const useRootHintVariables = (color: SigilColor) => {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.arcane-theme-root');
    if (!root) return;

    Object.entries(cssHintColorVariables(color)).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [color]);
};
