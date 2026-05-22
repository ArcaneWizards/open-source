import { useBrowserContext } from '@arcanewizards/sigil/frontend';
import { useCallback } from 'react';

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
