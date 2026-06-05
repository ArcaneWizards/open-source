import {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { STRINGS } from '../constants';
import { PrimaryToolboxSection } from './util';
import { NoToolboxChildren } from './content';
import { ConfigContext, SystemContext, useApplicationState } from './context';
import { AssignToOutputCallback, DialogMode, SettingsProps } from './types';
import {
  ControlButton,
  ControlColorSelect,
  ControlDialog,
  ControlDialogButtons,
  ControlInput,
  ControlLabel,
  ControlSelect,
  SelectOption,
} from '@arcanewizards/sigil/frontend/controls';
import {
  GeneratorClockDefinition,
  GeneratorConfig,
  GeneratorDefinition,
  isAudioPlayerGenerator,
  TimecodeInstanceId,
  ToolboxRootGetTimezoneInfoReturn,
} from '../../proto';
import { v4 as uuidv4 } from 'uuid';
import {
  ChangeCommitContext,
  useChangeCommitBoundary,
} from '@arcanewizards/sigil/frontend/context';
import {
  TimecodeDisplayProps,
  TimecodeTreeDisplay,
  useTimecodeLabels,
} from './core/timecode-display';
import { WithAudioPlayer } from './core/audio-player';
import { DelayConfig } from './core/delay';
import { AudioPlaybackContextProvider } from './core/audio-context';

const CLOCK_MODE_OPTIONS: Array<
  SelectOption<GeneratorClockDefinition['mode']>
> = [
  { label: 'Manual', value: 'manual' },
  { label: 'System Time', value: 'system' },
];

const ClockSpecificSettings: FC<SettingsProps<GeneratorDefinition>> = ({
  data,
  updateSettings,
}) => {
  const { commitChanges } = useContext(ChangeCommitContext);
  const { getTimezoneInfo } = useContext(SystemContext);

  const [timezoneInfo, setTimezoneInfo] =
    useState<ToolboxRootGetTimezoneInfoReturn | null>(null);

  useEffect(
    () =>
      void getTimezoneInfo()
        .then(setTimezoneInfo)
        .catch((cause) => {
          const error = new Error(`Error getting timezone info`, { cause });
          // eslint-disable-next-line no-console
          console.error(error);
        }),
    [getTimezoneInfo],
  );

  const defaultTimezoneLabel = `System Timezone (${timezoneInfo?.systemTimezone ?? 'Unknown'})`;

  const timezoneOptions: Array<SelectOption<string | null>> = useMemo(
    () => [
      {
        label: defaultTimezoneLabel,
        value: null,
      },
      ...(timezoneInfo?.timezones.map(({ name }) => ({
        label: name,
        value: name,
      })) ?? []),
    ],
    [timezoneInfo, defaultTimezoneLabel],
  );

  if (data.type !== 'clock' || !timezoneInfo) {
    return null;
  }

  return (
    <>
      <ControlLabel>Mode</ControlLabel>
      <ControlSelect
        value={data.mode}
        options={CLOCK_MODE_OPTIONS}
        onChange={(mode) => {
          updateSettings((current) =>
            current.type === 'clock'
              ? {
                  type: 'clock',
                  ...(mode === 'manual'
                    ? {
                        mode: 'manual',
                        speed: 1,
                      }
                    : {
                        mode: 'system',
                        timezone: null,
                      }),
                }
              : current,
          );
        }}
        position="both"
        variant="large"
      />
      {data.mode === 'manual' ? (
        <>
          <ControlLabel>Speed</ControlLabel>
          <ControlInput
            position="both"
            type="number"
            min="0.1"
            max="4"
            step="0.1"
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
      ) : (
        <>
          <ControlLabel>TimeZone</ControlLabel>
          <ControlSelect
            value={data.timezone ?? null}
            options={timezoneOptions}
            placeholder={defaultTimezoneLabel}
            onChange={(timezone) => {
              updateSettings((current) => ({
                ...current,
                timezone,
              }));
            }}
            position="both"
            variant="large"
          />
        </>
      )}
    </>
  );
};

const AudioPlayerSpecificSettings: FC<SettingsProps<GeneratorDefinition>> = ({
  data,
  updateSettings,
}) => {
  const { commitChanges } = useContext(ChangeCommitContext);

  if (data.type !== 'player') {
    return null;
  }

  return (
    <>
      <ControlLabel>Speed</ControlLabel>
      <ControlInput
        position="both"
        type="number"
        min="0.1"
        max="4"
        step="0.1"
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
  setDialogMode: (mode: DialogMode | null) => void;
};

export const GeneratorSettingsDialog: FC<GeneratorSettingsDialogProps> = ({
  target,
  generator,
  setDialogMode,
}) => {
  const { config, updateConfig } = useContext(ConfigContext);
  const [newData, setNewData] = useState<GeneratorConfig>({
    name: '',
    definition:
      generator === 'clock'
        ? { type: 'clock', mode: 'manual', speed: 1 }
        : {
            type: generator,
            filePath: null,
            speed: 1,
            volume: 1,
          },
  });

  const close = useCallback(() => setDialogMode(null), [setDialogMode]);

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
        {data.definition.type === 'player' ? (
          <AudioPlayerSpecificSettings
            data={data.definition}
            updateSettings={updateDefinition}
          />
        ) : null}

        <DelayConfig
          delayMs={data.delayMs}
          commitChanges={commitChanges}
          updateDelay={(delayMs) => {
            updateSettings((current) => ({
              ...current,
              delayMs,
            }));
          }}
        />
        {target.type === 'add' ? (
          <ControlDialogButtons>
            <ControlButton onClick={close} variant="large">
              Cancel
            </ControlButton>
            <ControlButton onClick={addGenerator} variant="large">
              Add Generator
            </ControlButton>
          </ControlDialogButtons>
        ) : target.type === 'edit' ? (
          <ControlDialogButtons>
            <ControlButton
              onClick={() =>
                setDialogMode({
                  section: { type: 'generators', generator },
                  target: { type: 'delete', uuid: target.uuid },
                })
              }
              variant="large"
              destructive
              icon="delete"
            >
              Delete
            </ControlButton>
            <ControlButton onClick={close} variant="large">
              Close
            </ControlButton>
          </ControlDialogButtons>
        ) : null}
      </ControlDialog>
    </ChangeCommitContext.Provider>
  );
};

type GeneratorDisplayProps = {
  uuid: string;
  config: GeneratorConfig;
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: AssignToOutputCallback;
  loadFile: TimecodeDisplayProps['loadFile'] | null;
  startPlayer: TimecodeDisplayProps['startPlayer'] | null;
  additionalErrors: string[];
};

const GeneratorDisplay: FC<GeneratorDisplayProps> = ({
  uuid,
  config,
  setDialogMode,
  assignToOutput,
  loadFile,
  startPlayer,
  additionalErrors,
}) => {
  const { generators } = useApplicationState();
  const state = generators[uuid];

  const rootState = useMemo(
    () => ({
      errors: [...(state?.errors ?? []), ...additionalErrors],
      warnings: state?.warnings ?? [],
    }),
    [state?.errors, state?.warnings, additionalErrors],
  );

  const id: TimecodeInstanceId = useMemo(() => ['generator', uuid], [uuid]);
  const labels = useTimecodeLabels(id);

  return (
    <TimecodeTreeDisplay
      id={id}
      config={{
        delayMs: config.delayMs ?? null,
        definition: config.definition,
      }}
      type={STRINGS.generators.type[config.definition.type]}
      name={config.name ? [config.name] : []}
      color={config.color}
      timecode={state?.timecode ?? null}
      rootState={rootState}
      namePlaceholder={STRINGS.generators.unnamed}
      loadFile={loadFile}
      startPlayer={startPlayer}
      ltc={null}
      buttons={
        <>
          <ControlButton
            variant="large"
            title={STRINGS.generators.edit}
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
      labels={labels}
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
          {(['clock', 'player'] as const).map((generator) => (
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
          {Object.entries(config.generators).map(([uuid, generator]) =>
            isAudioPlayerGenerator(generator) ? (
              <AudioPlaybackContextProvider key={uuid} id={['generator', uuid]}>
                <WithAudioPlayer
                  uuid={uuid}
                  config={generator}
                  timecodeDisplay={({ loadFile, startPlayer, errors }) => (
                    <GeneratorDisplay
                      key={uuid}
                      uuid={uuid}
                      config={generator}
                      setDialogMode={setDialogMode}
                      assignToOutput={assignToOutput}
                      loadFile={loadFile}
                      startPlayer={startPlayer}
                      additionalErrors={errors}
                    />
                  )}
                />
              </AudioPlaybackContextProvider>
            ) : (
              <GeneratorDisplay
                key={uuid}
                uuid={uuid}
                config={generator}
                setDialogMode={setDialogMode}
                assignToOutput={assignToOutput}
                loadFile={null}
                startPlayer={null}
                additionalErrors={[]}
              />
            ),
          )}
        </div>
      )}
    </PrimaryToolboxSection>
  );
};
