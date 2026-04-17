import {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AppearanceSwitcher } from '@arcanewizards/sigil/frontend/appearance';
import { useBrowserPreferences } from './preferences';
import {
  ControlButton,
  ControlDetails,
  ControlInput,
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
import { ConfigContext, NetworkContext, useApplicationState } from './context';
import { ToolboxRootGetNetworkInterfacesReturn } from '../../proto';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { useBrowserContext } from '@arcanewizards/sigil/frontend';
import { ListenerConfig } from '@arcanewizards/sigil';
import { portString } from '@arcanewizards/sigil/shared/config';

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

type InterfaceChoice = 'any' | `specific:${string}`;

const AppPortConfig: FC = () => {
  const { getNetworkInterfaces } = useContext(NetworkContext);
  const [interfaces, setInterfaces] =
    useState<ToolboxRootGetNetworkInterfacesReturn | null>(null);

  const refreshInterfaces = useCallback(() => {
    setInterfaces(null);
    getNetworkInterfaces().then((ifs) => setInterfaces(ifs));
  }, [getNetworkInterfaces]);

  useEffect(() => {
    refreshInterfaces();
  }, [refreshInterfaces]);

  const { appListenerChangesHandledExternally } = useBrowserContext();

  const { network, config, updateConfig } = useContext(ConfigContext);

  const [nextPort, setNextPort] = useState<string | null>(null);
  const [nextInterface, setNextInterface] = useState<InterfaceChoice | null>(
    null,
  );

  const iface: InterfaceChoice =
    nextInterface ??
    (config.appListener?.interface
      ? `specific:${config.appListener?.interface}`
      : 'any');
  const port = nextPort ?? config.appListener?.port;
  const currentPortString = !port
    ? ''
    : typeof port === 'string'
      ? port
      : portString(port);

  const hasNetworkChanges = nextPort !== null || nextInterface !== null;

  const nextUrlRef = useRef<URL | null>(null);

  const validatedPort:
    | { type: 'invalid'; error: string }
    | { type: 'valid'; port: ListenerConfig['port'] }
    | { type: 'empty' }
    | { type: 'unchanged' } = useMemo(() => {
    if (nextPort === null) {
      return { type: 'unchanged' };
    }
    if (nextPort.trim() === '') {
      return { type: 'empty' };
    }
    const portParts = nextPort
      .split('-')
      .map((part) => parseInt(part.trim(), 10));
    if (portParts.length === 1) {
      const [singlePort] = portParts;
      if (
        !singlePort ||
        isNaN(singlePort) ||
        singlePort < 1 ||
        singlePort > 65535
      ) {
        return {
          type: 'invalid',
          error: STRINGS.settings.network.invalidPortSingle,
        };
      }
      return { type: 'valid', port: singlePort };
    }
    if (portParts.length === 2) {
      const [from, to] = portParts;
      if (
        !from ||
        isNaN(from) ||
        from < 1 ||
        from > 65535 ||
        !to ||
        isNaN(to) ||
        to < 1 ||
        to > 65535
      ) {
        return {
          type: 'invalid',
          error: STRINGS.settings.network.invalidPortSingle,
        };
      } else if (from > to) {
        return {
          type: 'invalid',
          error: STRINGS.settings.network.invalidPortRange,
        };
      }
      return { type: 'valid', port: { from, to } };
    }
    return { type: 'invalid', error: STRINGS.settings.network.invalidPort };
  }, [nextPort]);

  const canSave = hasNetworkChanges && validatedPort?.type !== 'invalid';

  const saveNetworkConfig = useCallback(() => {
    if (validatedPort?.type === 'invalid') {
      return;
    }
    const newPort = validatedPort;
    updateConfig((current) => {
      const config = {
        ...current,
        appListener: {
          port:
            newPort.type === 'empty'
              ? undefined
              : newPort.type === 'valid'
                ? newPort.port
                : current.appListener?.port,
          interface:
            nextInterface === 'any'
              ? undefined
              : nextInterface
                ? nextInterface.replace('specific:', '')
                : current.appListener?.interface,
        },
      };
      const nextUrl = new URL(window.location.href);
      if (config.appListener?.interface) {
        nextUrl.hostname =
          interfaces?.[config.appListener.interface]?.address ??
          nextUrl.hostname;
      }
      const port = config.appListener?.port ?? network.defaultPort;
      nextUrl.port = (typeof port === 'number' ? port : port.from).toString();
      nextUrlRef.current = nextUrl;
      return config;
    });
    setNextPort(null);
    setNextInterface(null);
  }, [
    interfaces,
    nextInterface,
    validatedPort,
    updateConfig,
    network.defaultPort,
  ]);

  useEffect(() => {
    return () => {
      if (!appListenerChangesHandledExternally && nextUrlRef.current) {
        // Update the URL when unmounted
        window.location.href = nextUrlRef.current.href;
      }
    };
  }, [appListenerChangesHandledExternally]);

  return (
    <>
      <ControlLabel>{STRINGS.settings.network.appInterfaceLabel}</ControlLabel>
      <ControlSelect<InterfaceChoice>
        value={iface}
        options={[
          { label: STRINGS.settings.network.anyInterface, value: 'any' },
          ...(!interfaces
            ? []
            : Object.values(interfaces).map((iface) => ({
                label: `${iface.name} (${iface.address})`,
                value: `specific:${iface.name}` satisfies InterfaceChoice,
              }))),
        ]}
        onChange={setNextInterface}
        position="first"
        variant="large"
        triggerClassName={cn('text-sigil-control')}
      />
      {iface && interfaces?.[iface]?.internal && (
        <ControlDetails
          position="second"
          className="text-sigil-warning-foreground"
        >
          {STRINGS.settings.network.internalInterfaceUsed(iface)}
        </ControlDetails>
      )}
      <ControlButton
        onClick={refreshInterfaces}
        title="Refresh Interfaces"
        position="extra"
        variant="large"
      >
        <Icon icon="refresh" className="text-arcane-normal" />
      </ControlButton>
      <ControlLabel>{STRINGS.settings.network.appPortLabel}</ControlLabel>
      {network.envPort ? (
        <ControlDetails position="both">
          {STRINGS.settings.network.appPortEnvOverride(network.envPort)}
        </ControlDetails>
      ) : (
        <>
          <ControlInput
            value={currentPortString}
            onChange={setNextPort}
            placeholder={STRINGS.settings.network.defaultPort(
              portString(network.defaultPort),
            )}
          />
          {validatedPort.type === 'invalid' && (
            <ControlDetails
              position="second"
              className="text-sigil-error-foreground"
            >
              {validatedPort.error}
            </ControlDetails>
          )}
        </>
      )}
      <ControlButton
        onClick={saveNetworkConfig}
        variant="large"
        position="first"
        disabled={!canSave}
      >
        {STRINGS.settings.network.saveChanges}
      </ControlButton>
      {hasNetworkChanges && appListenerChangesHandledExternally && (
        <ControlDetails position="second">
          {STRINGS.settings.network.saveWarning.external}
        </ControlDetails>
      )}
      {hasNetworkChanges && !appListenerChangesHandledExternally && (
        <ControlDetails
          position="second"
          className="text-sigil-warning-foreground"
        >
          {STRINGS.settings.network.saveWarning.internal}
        </ControlDetails>
      )}
    </>
  );
};

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
          <AppPortConfig />
        </div>
      </div>
    </div>
  );
};
