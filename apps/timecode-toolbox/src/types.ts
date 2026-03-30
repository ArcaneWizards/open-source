import { Dispatch, SetStateAction } from 'react';
import { ApplicationState, AvailableHandlers } from './components/proto';
import { Tree } from './tree';

export type TimecodeHandlersInstance = Partial<
  Record<keyof AvailableHandlers, () => void>
>;

export type TimecodeHandlers = Tree<TimecodeHandlersInstance>;

export type StateSensitiveComponentProps = {
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
};

export type HandlersUpdater = Dispatch<SetStateAction<TimecodeHandlers>>;
