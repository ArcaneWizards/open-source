import { Dispatch, SetStateAction } from 'react';
import { ApplicationState, TimecodeHandlerMethods } from './components/proto';
import { Tree } from './tree';
import type { MIDIInterface } from '@arcanewizards/midi';

export type TimecodeHandlers = Tree<TimecodeHandlerMethods>;

export type StateSensitiveComponentProps = {
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
};

export type StateSensitiveComponentPropsWithMidi =
  StateSensitiveComponentProps & {
    midi: MIDIInterface | null;
  };

export type HandlersUpdater = Dispatch<SetStateAction<TimecodeHandlers>>;
