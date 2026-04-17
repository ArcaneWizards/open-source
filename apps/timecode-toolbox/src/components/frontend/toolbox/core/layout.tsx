import { ControlButton } from '@arcanewizards/sigil/frontend/controls';
import {
  ToolbarDivider,
  ToolbarRow,
  ToolbarWrapper,
} from '@arcanewizards/sigil/frontend/toolbars';
import { JSX, ReactNode, useContext, useState } from 'react';
import { STRINGS } from '../../constants';
import { Footer } from './footer';
import { SizeAwareDiv } from './size-aware-div';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { StageContext } from '@arcanejs/toolkit-frontend';
import { useBrowserPreferences } from '../preferences';
import { useRootHintVariables } from '@arcanewizards/sigil/frontend/styling.hooks';

type WindowModeDef<WindowMode extends string> = {
  child: (
    setWindowMode: React.Dispatch<React.SetStateAction<WindowMode | null>>,
  ) => JSX.Element;
  icon: string;
  title: string;
};

type LayoutProps<WindowMode extends string> = {
  modes: Record<WindowMode, WindowModeDef<WindowMode>> | null;
  children: ReactNode;
  licenseMode?: WindowMode;
  footer?: boolean;
};

export const Layout = <WindowMode extends string>({
  modes,
  children,
  licenseMode,
  footer,
}: LayoutProps<WindowMode>) => {
  const [windowMode, setWindowMode] = useState<WindowMode | null>(null);

  const { connection, reconnect } = useContext(StageContext);

  const { preferences } = useBrowserPreferences();

  useRootHintVariables(preferences.color);

  return (
    <div className="flex h-dvh flex-col">
      <ToolbarWrapper>
        <ToolbarRow>
          <div
            className="
              flex h-full min-h-[36px] grow items-center justify-center px-1
              app-title-bar
            "
          >
            <span className="font-bold text-hint-gradient">
              {STRINGS.title}
            </span>
          </div>
          {modes && (
            <>
              <ToolbarDivider />
              {(
                Object.entries(modes) as [
                  WindowMode,
                  WindowModeDef<WindowMode>,
                ][]
              ).map(([key, { icon, title }]) => (
                <ControlButton
                  key={key}
                  onClick={() =>
                    setWindowMode((mode) => (mode === key ? null : key))
                  }
                  variant="titlebar"
                  icon={icon}
                  active={windowMode === key}
                  title={STRINGS.toggle(title)}
                />
              ))}
            </>
          )}
        </ToolbarRow>
      </ToolbarWrapper>
      <div className="relative flex h-0 grow flex-col">
        {connection.state !== 'connected' ? (
          <SizeAwareDiv
            className="
              flex grow flex-col items-center justify-center gap-1
              bg-sigil-bg-light p-1 text-sigil-foreground-muted
            "
          >
            <Icon icon="signal_disconnected" className="text-block-icon" />
            <div className="text-center">{STRINGS.connectionError}</div>
            <ControlButton onClick={reconnect} variant="large" icon="replay">
              {STRINGS.reconnect}
            </ControlButton>
          </SizeAwareDiv>
        ) : windowMode && modes?.[windowMode] ? (
          modes[windowMode].child(setWindowMode)
        ) : (
          children
        )}
      </div>
      {footer && (
        <Footer
          openLicenseDetails={
            licenseMode &&
            (() =>
              setWindowMode((mode) =>
                mode === licenseMode ? null : licenseMode,
              ))
          }
        />
      )}
    </div>
  );
};
