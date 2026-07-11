import { createContext, useContext } from 'react';
import {
  ApplicationState,
  AvailableHandlers,
  ToolboxConfig,
  ToolboxRootCallHandler,
  ToolboxRootComponent,
  ToolboxRootGetMidiDevicesReturn,
  ToolboxRootGetMidiSupportInfoReturn,
  ToolboxRootGetNetworkInterfacesReturn,
  ToolboxRootGetTimezoneInfoReturn,
} from '../../proto';
import { Tree } from '../../../tree';

export type ConfigContextData = {
  config: ToolboxConfig;
  network: ToolboxRootComponent['network'];
  updateConfig: (change: (current: ToolboxConfig) => ToolboxConfig) => void;
};

export const ConfigContext = createContext<ConfigContextData>(
  new Proxy({} as ConfigContextData, {
    get() {
      throw new Error('ConfigContext not initialized');
    },
  }),
);

export const ApplicationStateContext = createContext<ApplicationState>({
  updates: null,
  inputs: {},
  outputs: {},
  generators: {},
});

export const useApplicationState = () => useContext(ApplicationStateContext);

export type ApplicationHandlersContextData = {
  handlers: Tree<AvailableHandlers>;
  callHandler<H extends keyof AvailableHandlers>(
    args: Pick<ToolboxRootCallHandler<H>, 'path' | 'handler' | 'args'>,
  ): Promise<void>;
};

export const ApplicationHandlersContext =
  createContext<ApplicationHandlersContextData>(
    new Proxy({} as ApplicationHandlersContextData, {
      get() {
        throw new Error('ApplicationHandlersContext not initialized');
      },
    }),
  );

export const useApplicationHandlers = () =>
  useContext(ApplicationHandlersContext);

export type SystemContextData = {
  getNetworkInterfaces: () => Promise<ToolboxRootGetNetworkInterfacesReturn>;
  getMidiDevices: () => Promise<ToolboxRootGetMidiDevicesReturn>;
  getMidiSupportInfo: () => Promise<ToolboxRootGetMidiSupportInfoReturn>;
  getTimezoneInfo: () => Promise<ToolboxRootGetTimezoneInfoReturn>;
};

export const SystemContext = createContext<SystemContextData>(
  new Proxy({} as SystemContextData, {
    get() {
      throw new Error('NetworkContext not initialized');
    },
  }),
);

export type GlobalUserInteractionsContextData = {
  draggingFileIntoWindow: boolean;
};

export const GlobalUserInteractionsContext =
  createContext<GlobalUserInteractionsContextData>({
    draggingFileIntoWindow: false,
  });

export const useGlobalUserInteractions = () =>
  useContext(GlobalUserInteractionsContext);
