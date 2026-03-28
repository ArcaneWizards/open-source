import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { AppRootLogEntry, SystemInformation } from '../shared/types';

export const SystemInformationContext = createContext<SystemInformation>(
  new Proxy({} as SystemInformation, {
    get: () => {
      throw new Error('Missing SystemInformationContext');
    },
  }),
);

export type DebuggerContextData = {
  setDebugMode: (enabled: boolean) => void;
  logs: AppRootLogEntry[];
};

export const DebuggerContext = createContext<DebuggerContextData>(
  new Proxy({} as DebuggerContextData, {
    get: () => {
      throw new Error('Missing DebuggerContext');
    },
  }),
);

export const useSystemInformation = () => {
  return useContext(SystemInformationContext);
};

export const useDebuggerContext = () => {
  return useContext(DebuggerContext);
};

/**
 * Context used to signal that changes have been made that should be committed.
 * This is used to easily signal when a user has made as many changes as they intend to,
 * and then want to commit the changes.
 */
export type ChangeCommitContextData = {
  commitChanges: () => void;
};

export const ChangeCommitContext = createContext<ChangeCommitContextData>({
  commitChanges: () => {
    /* no-op when not provided */
  },
});

/**
 * Create a commit boundary that can by frontend components that
 * a user wants to finish making changes.
 *
 * This allows for components to wait until a change has been fully committed
 * and propagated, and then perform an action,
 * such as closing a dialog, or moving focus to another component.
 */
export const useChangeCommitBoundary = (
  dataRef: unknown,
  onCommit: () => void,
): ChangeCommitContextData => {
  const shouldCommit = useRef(false);
  const commitTimeout = useRef<NodeJS.Timeout | null>(null);

  const doClearTimeout = () => {
    if (commitTimeout.current) {
      clearTimeout(commitTimeout.current);
      commitTimeout.current = null;
    }
  };

  const commitChanges = useCallback(() => {
    shouldCommit.current = true;
    // Set a timeout to reset shouldCommit after a short delay
    commitTimeout.current = setTimeout(() => {
      onCommit();
      shouldCommit.current = false;
      commitTimeout.current = null;
    }, 1000);
  }, [onCommit]);

  useEffect(() => {
    if (shouldCommit.current) {
      onCommit();
      shouldCommit.current = false;
    }
    // Always clear timeout when data changes, or component unmounts
    doClearTimeout();
    return () => {
      doClearTimeout();
    };
  }, [dataRef, onCommit]);

  return {
    commitChanges,
  };
};
