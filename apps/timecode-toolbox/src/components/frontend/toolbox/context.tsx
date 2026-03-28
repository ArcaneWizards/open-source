import { createContext, useContext } from 'react';
import {
  ApplicationState,
  ToolboxConfig,
  ToolboxRootGetNetworkInterfacesReturn,
} from '../../proto';

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
