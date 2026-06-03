import { useBrowserContext } from '@arcanewizards/sigil/frontend';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SystemContext } from './context';
import { ToolboxRootGetNetworkInterfacesReturn } from '../../proto';

type ResolvedFile =
  | {
      type: 'remote';
      file: File;
    }
  | {
      type: 'local';
      filePath: string;
    };

/**
 * Where possible, convert a File object to a local file path
 * (which is only going to be possible from electron windows).
 *
 * When this isn't possible, we still may be able to use the File object directly.
 */
export const useFileResolver = () => {
  const { getPathForFile } = useBrowserContext();
  return useCallback(
    (file: File): ResolvedFile => {
      const path = getPathForFile?.(file);
      if (path) {
        return {
          type: 'local',
          filePath: path,
        };
      }
      return {
        type: 'remote',
        file,
      };
    },
    [getPathForFile],
  );
};

export const useNetworkInterfaces = (initialFetch: boolean = true) => {
  const { getNetworkInterfaces } = useContext(SystemContext);
  const [interfaces, setInterfaces] =
    useState<ToolboxRootGetNetworkInterfacesReturn | null>(null);

  const refreshInterfaces = useCallback(() => {
    setInterfaces(null);
    getNetworkInterfaces().then((ifs) => setInterfaces(ifs));
  }, [getNetworkInterfaces]);

  useEffect(() => {
    if (initialFetch) {
      refreshInterfaces();
    }
  }, [refreshInterfaces, initialFetch]);

  return { interfaces, refreshInterfaces };
};

export const useNetworkInterfaceInfo = (iface: string | null) => {
  /**
   * Don't auto-fetch, only fetch when iface is not null
   */
  const { interfaces, refreshInterfaces } = useNetworkInterfaces(false);

  const interfacesRef = useRef(interfaces);

  useEffect(() => {
    interfacesRef.current = interfaces;
  }, [interfaces]);

  useEffect(() => {
    // If we aren't aware of the current interface, refresh the list
    // (only once per interface change, to avoid infinite loops).
    if (iface && !interfacesRef.current?.[iface]) {
      refreshInterfaces();
    }
  }, [iface, refreshInterfaces]);

  return (iface && interfaces?.[iface]) || null;
};
