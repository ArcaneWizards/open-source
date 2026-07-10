import { ControlButton } from '@arcanewizards/sigil/frontend/controls';
import {
  ToolbarDivider,
  ToolbarRow,
  ToolbarWrapper,
} from '@arcanewizards/sigil/frontend/toolbars';
import { Fragment, ReactNode, useCallback, useContext, useState } from 'react';
import { STRINGS } from '../../constants';
import { Footer } from './footer';
import { SizeAwareDiv } from './size-aware-div';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { StageContext } from '@arcanejs/toolkit-frontend';
import { useBrowserPreferences } from '../preferences';
import { useRootHintVariables } from '@arcanewizards/sigil/frontend/styling.hooks';
import { UpdateBanner } from '@arcanewizards/sigil/frontend/updates';
import { useApplicationState } from '../context';

type WindowModeDef<WindowMode extends string> = {
  child: (
    setWindowMode: React.Dispatch<React.SetStateAction<WindowMode | null>>,
  ) => ReactNode;
  button: {
    icon: string;
    title: string;
  } | null;
};

type LayoutProps<WindowMode extends string> = {
  modes: Record<WindowMode, WindowModeDef<WindowMode>> | null;
  children: ReactNode;
  licenseMode?: WindowMode;
  footer?: boolean;
};

export const UPDATE_DETAILS_WINDOW_MODE = 'update-details' as const;

export const Layout = <WindowMode extends string>({
  modes,
  children,
  licenseMode,
  footer,
}: LayoutProps<WindowMode>) => {
  const [windowMode, setWindowMode] = useState<WindowMode | null>(null);

  const { connection, reconnect } = useContext(StageContext);

  const { preferences } = useBrowserPreferences();

  const { updates } = useApplicationState();

  useRootHintVariables(preferences.color);

  const viewUpdateDetails = useCallback(() => {
    if (modes?.[UPDATE_DETAILS_WINDOW_MODE as WindowMode]) {
      setWindowMode(UPDATE_DETAILS_WINDOW_MODE as WindowMode);
    }
  }, [modes]);

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
              ).map(([key, { button }]) => (
                <Fragment key={key}>
                  {button && (
                    <ControlButton
                      onClick={() =>
                        setWindowMode((mode) => (mode === key ? null : key))
                      }
                      variant="titlebar"
                      icon={button.icon}
                      active={windowMode === key}
                      title={STRINGS.toggle(button.title)}
                    />
                  )}
                </Fragment>
              ))}
            </>
          )}
        </ToolbarRow>
      </ToolbarWrapper>
      <UpdateBanner
        strings={STRINGS.updates.banner}
        updates={updates}
        openDetails={viewUpdateDetails}
      />
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
        ) : (
          <>
            {windowMode && modes?.[windowMode] && (
              <div className="flex size-full flex-col">
                {modes[windowMode].child(setWindowMode)}
              </div>
            )}
            {children}
          </>
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
