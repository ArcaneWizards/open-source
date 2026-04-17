import {
  GeneratorDefinition,
  InputDefinition,
  InputOrGenInstance,
  OutputDefinition,
} from '../../proto';

export type DialogMode = {
  section:
    | { type: 'inputs'; input: InputDefinition['type'] }
    | { type: 'generators'; generator: GeneratorDefinition['type'] }
    | { type: 'outputs'; output: OutputDefinition['type'] };
  target:
    | {
        type: 'add';
      }
    | {
        type: 'edit';
        uuid: string;
      }
    | {
        type: 'delete';
        uuid: string;
      };
};

export type DialogModeDelete = DialogMode & { target: { type: 'delete' } };

export const isDeleteDialogMode = (
  mode: DialogMode | null,
): mode is DialogModeDelete => {
  return mode?.target.type === 'delete';
};

export type SettingsProps<T> = {
  data: T;
  updateSettings: (change: (current: T) => T) => void;
};

export type AssignToOutputCallback = ((id: InputOrGenInstance) => void) | null;
