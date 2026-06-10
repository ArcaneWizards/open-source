import { FC, useCallback, useContext, useMemo, useState } from 'react';
import { STRINGS } from '../constants';
import { PrimaryToolboxSection } from './util';
import { ConfigContext, useApplicationState } from './context';
import {
  ControlButton,
  ControlColorSelect,
  ControlDialog,
  ControlDialogButtons,
  ControlInput,
  ControlLabel,
  ControlParagraph,
  ControlSelect,
} from '@arcanewizards/sigil/frontend/controls';
import { AssignToOutputCallback, DialogMode, SettingsProps } from './types';
import {
  InputConfig,
  InputDefinition,
  InputLtcDefinition,
  isLtcInput,
  MidiTargetConfig,
  TimecodeInstanceId,
} from '../../proto';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { ARTNET_PORT, TimecodeMode } from '@arcanewizards/artnet/constants';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@arcanejs/toolkit-frontend/util';
import {
  ChangeCommitContext,
  useChangeCommitBoundary,
} from '@arcanewizards/sigil/frontend/context';
import {
  TimecodeTreeDisplay,
  useTimecodeLabels,
} from './core/timecode-display';
import { NoToolboxChildren } from './content';
import { MidiTargetSettings } from './core/midi';
import { useNetworkInterfaces } from './hooks';
import { DelayConfig } from './core/delay';
import { AudioRecordingContextProvider } from './core/audio-context';
import { WithLtcRecorder } from './core/ltc/recorder';

const DmxConnectionSettings: FC<SettingsProps<InputDefinition>> = ({
  data,
  updateSettings,
}) => {
  const { commitChanges } = useContext(ChangeCommitContext);

  const { interfaces, refreshInterfaces } = useNetworkInterfaces();

  if (data.type !== 'artnet') {
    return null;
  }

  return (
    <>
      <ControlLabel>Interface</ControlLabel>
      <ControlButton
        onClick={refreshInterfaces}
        title="Refresh Interfaces"
        position="first"
        variant="large"
      >
        <Icon icon="refresh" className="text-arcane-normal" />
      </ControlButton>
      <ControlSelect
        value={data.iface ?? null}
        options={
          !interfaces
            ? []
            : Object.values(interfaces).map((iface) => ({
                label: `${iface.name} (${iface.address})`,
                value: iface.name,
              }))
        }
        placeholder="No Interface Selected"
        onChange={(value) => {
          updateSettings((current) => ({
            ...current,
            iface: value ?? '',
          }));
        }}
        position="second"
        variant="large"
        triggerClassName={cn('text-sigil-control')}
      />

      <ControlLabel>Port</ControlLabel>
      <ControlInput
        position="both"
        type="string"
        value={data.port?.toString() ?? ''}
        placeholder={`Default (${ARTNET_PORT})`}
        onChange={(value, enterPressed) => {
          const port = value ? parseInt(value, 10) : undefined;
          if (port !== undefined && isNaN(port)) {
            return;
          }
          updateSettings((current) => ({
            ...current,
            port,
          }));
          if (enterPressed) {
            commitChanges();
          }
        }}
      />
    </>
  );
};

const TCNetConnectionSettings: FC<SettingsProps<InputDefinition>> = ({
  data,
  updateSettings,
}) => {
  const { interfaces, refreshInterfaces } = useNetworkInterfaces();

  if (data.type !== 'tcnet') {
    return null;
  }

  return (
    <>
      <ControlLabel>Interface</ControlLabel>
      <ControlButton
        onClick={refreshInterfaces}
        title="Refresh Interfaces"
        position="first"
        variant="large"
      >
        <Icon icon="refresh" className="text-arcane-normal" />
      </ControlButton>
      <ControlSelect
        value={data.iface ?? null}
        options={
          !interfaces
            ? []
            : Object.values(interfaces).map((iface) => ({
                label: `${iface.name} (${iface.address})`,
                value: iface.name,
              }))
        }
        placeholder="No Interface Selected"
        onChange={(value) => {
          updateSettings((current) => ({
            ...current,
            iface: value ?? '',
          }));
        }}
        position="second"
        variant="large"
        triggerClassName={cn('text-sigil-control')}
      />
    </>
  );
};

const MIDIConnectionSettings: FC<
  SettingsProps<InputDefinition> & { name: string | undefined }
> = ({ name, data, updateSettings }) => {
  const updateMidiTarget = useCallback(
    (change: (current: MidiTargetConfig) => MidiTargetConfig) => {
      updateSettings((current) =>
        current.type === 'midi'
          ? {
              ...current,
              target: change(current.target),
            }
          : current,
      );
    },
    [updateSettings],
  );

  if (data.type !== 'midi') {
    return null;
  }

  return (
    <MidiTargetSettings
      type="input"
      name={name}
      target={data.target}
      updateTarget={updateMidiTarget}
    />
  );
};

const LTCConnectionSettings: FC<SettingsProps<InputDefinition>> = ({
  data,
  updateSettings,
}) => {
  const updateLtcSettings = useCallback(
    (change: (current: InputLtcDefinition) => InputLtcDefinition) => {
      updateSettings((current) =>
        current.type === 'ltc' ? change(current) : current,
      );
    },
    [updateSettings],
  );

  if (data.type !== 'ltc') {
    return null;
  }

  return (
    <>
      <ControlLabel>FPS</ControlLabel>
      <ControlSelect<TimecodeMode | 'AUTO'>
        position="both"
        variant="large"
        value={data.mode}
        options={[
          { label: 'Auto Detect Framerate', value: 'AUTO' },
          ...(
            Object.entries(STRINGS.smtpeModeOptions) as [TimecodeMode, string][]
          ).map(([mode, label]) => ({
            label,
            value: mode,
          })),
        ]}
        onChange={(mode) => {
          updateLtcSettings((current) => ({ ...current, mode }));
        }}
      />
      {data.mode === 'AUTO' && (
        <ControlParagraph mode="warning" className="max-w-[500px]">
          {STRINGS.ltc.autoDetectWarning}
        </ControlParagraph>
      )}
    </>
  );
};

type InputSettingsDialogProps = {
  target: DialogMode['target'];
  input: InputDefinition['type'];
  setDialogMode: (mode: DialogMode | null) => void;
};

const getDefaultInputConfigDefinition = (
  type: InputDefinition['type'],
): InputConfig['definition'] => {
  switch (type) {
    case 'artnet':
      return {
        type: 'artnet',
        iface: '',
        port: undefined,
      };
    case 'tcnet':
      return {
        type: 'tcnet',
        iface: '',
      };
    case 'midi':
      return {
        type: 'midi',
        target: {
          type: 'port',
          deviceName: '',
        },
      };
    case 'ltc':
      return {
        type: 'ltc',
        mode: 'AUTO',
      };
  }
};

export const InputSettingsDialog: FC<InputSettingsDialogProps> = ({
  target,
  input,
  setDialogMode,
}) => {
  const { config, updateConfig } = useContext(ConfigContext);
  const [newData, setNewData] = useState<InputConfig>({
    name: '',
    enabled: true,
    definition: getDefaultInputConfigDefinition(input),
  });

  const close = useCallback(() => setDialogMode(null), [setDialogMode]);

  const updateSettings: SettingsProps<InputConfig>['updateSettings'] =
    useCallback(
      (change) => {
        if (target.type === 'add') {
          setNewData(change);
        } else {
          updateConfig((current) => {
            const existing = current.inputs?.[target.uuid];
            if (!existing) {
              return current;
            }
            return {
              ...current,
              inputs: {
                ...current.inputs,
                [target.uuid]: change(existing),
              },
            };
          });
        }
      },
      [target, updateConfig],
    );

  const updateDefinition = useCallback(
    (change: (current: InputDefinition) => InputDefinition) => {
      updateSettings((current) => ({
        ...current,
        definition: change(current.definition),
      }));
    },
    [updateSettings],
  );

  const addInput = useCallback(() => {
    updateConfig((current) => {
      return {
        ...current,
        inputs: {
          ...current.inputs,
          [uuidv4()]: newData,
        },
      };
    });
    close();
  }, [newData, close, updateConfig]);

  const resolvedTarget =
    target.type === 'add' ? 'add' : config.inputs?.[target.uuid];

  const data = resolvedTarget === 'add' ? newData : resolvedTarget;

  const commitChanges = useCallback(() => {
    if (target.type === 'add') {
      addInput();
    } else {
      close();
    }
  }, [target, addInput, close]);

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
            ? STRINGS.inputs.addDialog(STRINGS.protocols[input].short)
            : STRINGS.inputs.editDialog(
                STRINGS.protocols[input].short,
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
        {data.definition.type === 'artnet' ? (
          <DmxConnectionSettings
            data={data.definition}
            updateSettings={updateDefinition}
          />
        ) : data.definition.type === 'tcnet' ? (
          <TCNetConnectionSettings
            data={data.definition}
            updateSettings={updateDefinition}
          />
        ) : data.definition.type === 'midi' ? (
          <MIDIConnectionSettings
            name={data.name}
            data={data.definition}
            updateSettings={updateDefinition}
          />
        ) : data.definition.type === 'ltc' ? (
          <LTCConnectionSettings
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
            <ControlButton onClick={addInput} variant="large" primary>
              Add Input
            </ControlButton>
          </ControlDialogButtons>
        ) : target?.type === 'edit' ? (
          <ControlDialogButtons>
            <ControlButton
              onClick={() =>
                setDialogMode({
                  section: { type: 'inputs', input },
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

type InputDisplayProps = {
  uuid: string;
  config: InputConfig;
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: AssignToOutputCallback;
};

export const InputDisplay: FC<InputDisplayProps> = ({
  uuid,
  config,
  setDialogMode,
  assignToOutput,
}) => {
  const { updateConfig } = useContext(ConfigContext);

  const { inputs } = useApplicationState();
  const state = inputs[uuid];

  const toggleEnabled = useCallback(() => {
    updateConfig((current) => {
      const existing = current.inputs?.[uuid];
      if (!existing) {
        return current;
      }
      return {
        ...current,
        inputs: {
          ...current.inputs,
          [uuid]: {
            ...existing,
            enabled: !existing.enabled,
          },
        },
      };
    });
  }, [uuid, updateConfig]);

  const rootState = useMemo(
    () => ({ errors: state?.errors ?? [], warnings: state?.warnings ?? [] }),
    [state?.errors, state?.warnings],
  );

  const id: TimecodeInstanceId = useMemo(() => ['input', uuid], [uuid]);
  const labels = useTimecodeLabels(id);

  const tc = (
    <TimecodeTreeDisplay
      id={id}
      config={{ delayMs: config.delayMs ?? null }}
      type={STRINGS.protocols[config.definition.type].short}
      name={config.name ? [config.name] : []}
      color={config.color}
      timecode={config.enabled ? (state?.timecode ?? null) : 'disabled'}
      rootState={rootState}
      namePlaceholder={STRINGS.inputs.unnamed}
      loadFile={null}
      startPlayer={null}
      buttons={
        <>
          <ControlButton
            variant="large"
            title={
              config.enabled ? STRINGS.inputs.disable : STRINGS.inputs.enable
            }
            onClick={toggleEnabled}
            icon={config.enabled ? 'pause' : 'play_arrow'}
          />
          <ControlButton
            variant="large"
            title={STRINGS.inputs.edit}
            onClick={() =>
              setDialogMode({
                section: { type: 'inputs', input: config.definition.type },
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

  if (isLtcInput(config)) {
    return (
      <AudioRecordingContextProvider id={['input', uuid]}>
        <WithLtcRecorder uuid={uuid} config={config}>
          {tc}
        </WithLtcRecorder>
      </AudioRecordingContextProvider>
    );
  }

  return tc;
};

export type InputSectionProps = {
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: AssignToOutputCallback;
};

export const InputsSection: FC<InputSectionProps> = ({
  setDialogMode,
  assignToOutput,
}) => {
  const { config } = useContext(ConfigContext);

  return (
    <PrimaryToolboxSection
      title={STRINGS.inputs.title}
      buttons={
        <>
          {(['artnet', 'tcnet', 'midi', 'ltc'] as const).map((type) => (
            <ControlButton
              key={type}
              onClick={() =>
                setDialogMode({
                  section: { type: 'inputs', input: type },
                  target: { type: 'add' },
                })
              }
              variant="toolbar"
              icon="add"
            >
              {STRINGS.inputs.addButton(STRINGS.protocols[type].long)}
              {type === 'ltc' && (
                <span
                  className="
                    ml-1 rounded-md bg-sigil-foreground px-1 py-0.3
                    text-sigil-control text-sigil-bg-dark
                  "
                >
                  BETA
                </span>
              )}
            </ControlButton>
          ))}
        </>
      }
    >
      {Object.entries(config.inputs ?? {}).length === 0 ? (
        <NoToolboxChildren text={STRINGS.inputs.noChildren} />
      ) : (
        <div
          className="
            grid grow grid-cols-1 gap-px
            min-[800px]:grid-cols-2
            min-[1200px]:grid-cols-3
          "
        >
          {Object.entries(config.inputs).map(([uuid, input]) => (
            <InputDisplay
              key={uuid}
              uuid={uuid}
              config={input}
              setDialogMode={setDialogMode}
              assignToOutput={assignToOutput}
            />
          ))}
        </div>
      )}
    </PrimaryToolboxSection>
  );
};
