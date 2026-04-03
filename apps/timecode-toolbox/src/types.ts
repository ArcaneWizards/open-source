import { Dispatch, SetStateAction } from 'react';
import { ApplicationState, TimecodeHandlerMethods } from './components/proto';
import { Tree } from './tree';

export type TimecodeHandlers = Tree<TimecodeHandlerMethods>;

export type StateSensitiveComponentProps = {
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
};

export type HandlersUpdater = Dispatch<SetStateAction<TimecodeHandlers>>;
