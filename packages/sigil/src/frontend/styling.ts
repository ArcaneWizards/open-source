import { useEffect, type CSSProperties } from 'react';
import { z } from 'zod';

export const SIGIL_COLOR = z.enum([
  'purple',
  'blue',
  'teal',
  'red',
  'green',
  'yellow',
  'brown',
  'orange',
  'gray',
]);

export type SigilColor = z.infer<typeof SIGIL_COLOR>;

export type SigilUsageColor = SigilColor | 'unknown';

export type SigilUsageColorUsage = {
  text: string;
  foreground: string;
  background: string;
  border: string;
  dragBorder: string;
  selectedBackground: string;
  selectedBorder: string;
  selectedText: string;
  dimmedBackground: string;
  dimmedBorder: string;
  gradientLight: string;
  gradientDark: string;
};

export const sigilColorUsage = (
  color: SigilUsageColor,
): SigilUsageColorUsage => ({
  text: `var(--sigil-usage-${color}-text)`,
  foreground: `var(--sigil-usage-${color}-foreground)`,
  background: `var(--sigil-usage-${color}-background)`,
  border: `var(--sigil-usage-${color}-border)`,
  dragBorder: `var(--sigil-usage-${color}-drag-border)`,
  selectedBackground: `var(--sigil-usage-${color}-selected-background)`,
  selectedBorder: `var(--sigil-usage-${color}-selected-border)`,
  selectedText: `var(--sigil-usage-${color}-selected-text)`,
  dimmedBackground: `var(--sigil-usage-${color}-dimmed-background)`,
  dimmedBorder: `var(--sigil-usage-${color}-dimmed-border)`,
  gradientLight: `var(--sigil-usage-${color}-gradient-light)`,
  gradientDark: `var(--sigil-usage-${color}-gradient-dark)`,
});

export const cssSigilColorUsageVariables = (
  prefix: string,
  usage: SigilUsageColorUsage,
): CSSProperties =>
  cssVariables({
    [`--${prefix}-text`]: usage.text,
    [`--${prefix}-foreground`]: usage.foreground,
    [`--${prefix}-background`]: usage.background,
    [`--${prefix}-border`]: usage.border,
    [`--${prefix}-drag-border`]: usage.dragBorder,
    [`--${prefix}-selected-background`]: usage.selectedBackground,
    [`--${prefix}-selected-border`]: usage.selectedBorder,
    [`--${prefix}-selected-text`]: usage.selectedText,
    [`--${prefix}-dimmed-background`]: usage.dimmedBackground,
    [`--${prefix}-dimmed-border`]: usage.dimmedBorder,
    [`--${prefix}-gradient-light`]: usage.gradientLight,
    [`--${prefix}-gradient-dark`]: usage.gradientDark,
  });

export const cssHintColorVariables = (color: SigilColor): CSSProperties =>
  cssSigilColorUsageVariables(`sigil-usage-hint`, sigilColorUsage(color));

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

export const cssVariables = (
  variables: Partial<Record<`--${string}`, string | number>>,
): CSSProperties => variables as CSSProperties;

export function cnd<T extends string>(
  condition: unknown,
  truthyClassName: T,
): T | undefined;
export function cnd<T extends string, F extends string>(
  condition: unknown,
  truthyClassName: T,
  falseyClassName: F,
): T | F;
export function cnd(
  condition: unknown,
  truthyClassName: string,
  falseyClassName?: string,
): string | undefined {
  return condition ? truthyClassName : falseyClassName;
}
