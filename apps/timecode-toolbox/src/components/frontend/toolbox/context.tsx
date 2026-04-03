import { createContext, useContext } from 'react';
import {
  ApplicationState,
  AvailableHandlers,
  ToolboxConfig,
  ToolboxRootCallHandler,
  ToolboxRootGetNetworkInterfacesReturn,
} from '../../proto';
import { Tree } from '../../../tree';

export type ConfigContextData = {
  config: ToolboxConfig;
  updateConfig: (change: (current: ToolboxConfig) => ToolboxConfig) => void;
};

export const ConfigContext = createContext<ConfigContextData>(
  new Proxy({} as ConfigContextData, {
    get() {
      throw new Error('ConfigContext not initialized');
    },
  }),
);

export const ApplicationStateContext = createContext<ApplicationState>(
  new Proxy({} as ApplicationState, {
    get() {
      throw new Error('ApplicationStateContext not initialized');
    },
  }),
);

export const useApplicationState = () => useContext(ApplicationStateContext);

export type ApplicationHandlersContextData = {
  handlers: Tree<AvailableHandlers>;
  callHandler(
    args: Pick<ToolboxRootCallHandler, 'path' | 'handler'>,
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

type NetworkContextData = {
  getNetworkInterfaces: () => Promise<ToolboxRootGetNetworkInterfacesReturn>;
};

export const NetworkContext = createContext<NetworkContextData>(
  new Proxy({} as NetworkContextData, {
    get() {
      throw new Error('NetworkContext not initialized');
    },
  }),
);
