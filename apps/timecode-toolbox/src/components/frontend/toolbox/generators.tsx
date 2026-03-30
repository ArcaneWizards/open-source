import { FC, useCallback, useContext, useState } from 'react';
import { STRINGS } from '../constants';
import { PrimaryToolboxSection } from './util';
import { NoToolboxChildren } from './content';
import { ConfigContext, useApplicationState } from './context';
import { AssignToOutputCallback, DialogMode, SettingsProps } from './types';
import {
  ControlButton,
  ControlColorSelect,
  ControlDialog,
  ControlDialogButtons,
  ControlInput,
  ControlLabel,
} from '@arcanewizards/sigil/frontend/controls';
import { GeneratorConfig, GeneratorDefinition } from '../../proto';
import { v4 as uuidv4 } from 'uuid';
import {
  ChangeCommitContext,
  useChangeCommitBoundary,
} from '@arcanewizards/sigil/frontend/context';
import { TimecodeTreeDisplay } from './core/timecode-display';

const ClockSpecificSettings: FC<SettingsProps<GeneratorDefinition>> = ({
  data,
  updateSettings,
}) => {
  const { commitChanges } = useContext(ChangeCommitContext);

  if (data.type !== 'clock') {
    return null;
  }

  return (
    <>
      <ControlLabel>Speed</ControlLabel>
      <ControlInput
        position="both"
        type="string"
        value={data.speed?.toString() ?? ''}
        placeholder={`Default (1)`}
        onChange={(value, enterPressed) => {
          const speed = value ? parseFloat(value) : 1;
          if (speed !== undefined && isNaN(speed)) {
            return;
          }
          updateSettings((current) => ({
            ...current,
            speed,
          }));
          if (enterPressed) {
            commitChanges();
          }
        }}
      />
    </>
  );
};

type GeneratorSettingsDialogProps = {
  target: DialogMode['target'];
  generator: GeneratorDefinition['type'];
  close: () => void;
};

export const GeneratorSettingsDialog: FC<GeneratorSettingsDialogProps> = ({
  target,
  generator,
  close,
}) => {
  const { config, updateConfig } = useContext(ConfigContext);
  const [newData, setNewData] = useState<GeneratorConfig>({
    name: '',
    definition: {
      type: generator,
      speed: 1,
    },
  });

  const updateSettings: SettingsProps<GeneratorConfig>['updateSettings'] =
    useCallback(
      (change) => {
        if (target.type === 'add') {
          setNewData(change);
        } else {
          updateConfig((current) => {
            const existing = current.generators?.[target.uuid];
            if (!existing) {
              return current;
            }
            return {
              ...current,
              generators: {
                ...current.generators,
                [target.uuid]: change(existing),
              },
            };
          });
        }
      },
      [target, updateConfig],
    );

  const updateDefinition = useCallback(
    (change: (current: GeneratorDefinition) => GeneratorDefinition) => {
      updateSettings((current) => ({
        ...current,
        definition: change(current.definition),
      }));
    },
    [updateSettings],
  );

  const addGenerator = useCallback(() => {
    updateConfig((current) => {
      return {
        ...current,
        generators: {
          ...current.generators,
          [uuidv4()]: newData,
        },
      };
    });
    close();
  }, [newData, close, updateConfig]);

  const resolvedTarget =
    target.type === 'add' ? 'add' : config.generators?.[target.uuid];

  const data = resolvedTarget === 'add' ? newData : resolvedTarget;

  const commitChanges = useCallback(() => {
    if (target.type === 'add') {
      addGenerator();
    } else {
      close();
    }
  }, [target, addGenerator, close]);

  const commitBoundary = useChangeCommitBoundary(data, commitChanges);

  if (!data) {
    return null;
  }

  return (
    <ChangeCommitContext.Provider value={commitBoundary}>
      <ControlDialog
        dialogClosed={close}
        title={
          target.type === 'add'
            ? STRINGS.generators.addDialog(STRINGS.generators.type[generator])
            : STRINGS.generators.editDialog(
                STRINGS.generators.type[generator],
                data.name || '',
              )
        }
      >
        <ControlLabel>Name</ControlLabel>
        <ControlInput
          position="both"
          type="string"
          value={data.name ?? ''}
          placeholder={`No name specified`}
          onChange={(name, enterPressed) => {
            if (enterPressed) {
              commitBoundary.commitChanges();
            }
            updateSettings((current) => ({
              ...current,
              name,
            }));
          }}
        />
        <ControlLabel>Color</ControlLabel>
        <ControlColorSelect
          position="both"
          color={data.color ?? ''}
          variant="standard"
          placeholder="Default"
          onChange={(color) => {
            updateSettings((current) => ({
              ...current,
              color,
            }));
          }}
        />
        {data.definition.type === 'clock' ? (
          <ClockSpecificSettings
            data={data.definition}
            updateSettings={updateDefinition}
          />
        ) : null}
        {resolvedTarget === 'add' ? (
          <ControlDialogButtons>
            <ControlButton onClick={close} variant="large">
              Cancel
            </ControlButton>
            <ControlButton onClick={addGenerator} variant="large">
              Add Generator
            </ControlButton>
          </ControlDialogButtons>
        ) : (
          <ControlDialogButtons>
            <ControlButton onClick={close} variant="large">
              Close
            </ControlButton>
          </ControlDialogButtons>
        )}
      </ControlDialog>
    </ChangeCommitContext.Provider>
  );
};

type GeneratorDisplayProps = {
  uuid: string;
  config: GeneratorConfig;
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: AssignToOutputCallback;
};

const GeneratorDisplay: FC<GeneratorDisplayProps> = ({
  uuid,
  config,
  setDialogMode,
  assignToOutput,
}) => {
  const { generators } = useApplicationState();
  const state = generators[uuid];

  return (
    <TimecodeTreeDisplay
      id={{ type: 'input', id: [uuid] }}
      config={{ delayMs: config.delayMs ?? null }}
      type={STRINGS.generators.type[config.definition.type]}
      name={config.name ? [config.name] : []}
      color={config.color}
      timecode={state?.timecode ?? null}
      namePlaceholder={`Unnamed Generator`}
      buttons={
        <>
          <ControlButton
            variant="large"
            title="Edit Generator"
            onClick={() =>
              setDialogMode({
                section: {
                  type: 'generators',
                  generator: config.definition.type,
                },
                target: { type: 'edit', uuid },
              })
            }
            icon="edit"
          />
        </>
      }
      assignToOutput={assignToOutput}
    />
  );
};

export type GeneratorsSectionProps = {
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: AssignToOutputCallback;
};

export const GeneratorsSection: FC<GeneratorsSectionProps> = ({
  setDialogMode,
  assignToOutput,
}) => {
  const { config } = useContext(ConfigContext);
  return (
    <PrimaryToolboxSection
      title={STRINGS.generators.title}
      buttons={
        <>
          {(['clock'] as const).map((generator) => (
            <ControlButton
              key={generator}
              onClick={() =>
                setDialogMode({
                  section: { type: 'generators', generator },
                  target: { type: 'add' },
                })
              }
              variant="toolbar"
              icon="add"
            >
              {STRINGS.outputs.addButton(STRINGS.generators.type[generator])}
            </ControlButton>
          ))}
        </>
      }
    >
      {Object.entries(config.generators ?? {}).length === 0 ? (
        <NoToolboxChildren text={STRINGS.generators.noChildren} />
      ) : (
        <div
          className="
            grid grow grid-cols-1 gap-px
            min-[600px]:grid-cols-2
            min-[900px]:grid-cols-3
          "
        >
          {Object.entries(config.generators).map(([uuid, generator]) => (
            <GeneratorDisplay
              key={uuid}
              uuid={uuid}
              config={generator}
              setDialogMode={setDialogMode}
              assignToOutput={assignToOutput}
            />
          ))}
        </div>
      )}
    </PrimaryToolboxSection>
  );
};
