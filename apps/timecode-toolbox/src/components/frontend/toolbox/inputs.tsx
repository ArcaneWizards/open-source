import { FC, useCallback, useContext, useEffect, useState } from 'react';
import { STRINGS } from '../constants';
import { PrimaryToolboxSection } from './util';
import { ConfigContext, NetworkContext, useApplicationState } from './context';
import {
  ControlButton,
  ControlColorSelect,
  ControlDialog,
  ControlDialogButtons,
  ControlInput,
  ControlLabel,
  ControlSelect,
} from '@arcanewizards/sigil/frontend/controls';
import { AssignToOutputCallback, DialogMode, SettingsProps } from './types';
import {
  InputConfig,
  InputDefinition,
  ToolboxRootGetNetworkInterfacesReturn,
} from '../../proto';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { ARTNET_PORT } from '@arcanewizards/artnet/constants';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@arcanejs/toolkit-frontend/util';
import {
  ChangeCommitContext,
  useChangeCommitBoundary,
} from '@arcanewizards/sigil/frontend/context';
import { TimecodeTreeDisplay } from './core/timecode-display';
import { NoToolboxChildren } from './content';

const DmxConnectionSettings: FC<SettingsProps<InputDefinition>> = ({
  data,
  updateSettings,
}) => {
  const { commitChanges } = useContext(ChangeCommitContext);
  const { getNetworkInterfaces } = useContext(NetworkContext);
  const [interfaces, setInterfaces] =
    useState<ToolboxRootGetNetworkInterfacesReturn | null>(null);

  const refreshInterfaces = useCallback(() => {
    setInterfaces(null);
    getNetworkInterfaces().then((ifs) => setInterfaces(ifs));
  }, [getNetworkInterfaces]);

  useEffect(() => {
    refreshInterfaces();
  }, [refreshInterfaces]);

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
  const { getNetworkInterfaces } = useContext(NetworkContext);
  const [interfaces, setInterfaces] =
    useState<ToolboxRootGetNetworkInterfacesReturn | null>(null);

  const refreshInterfaces = useCallback(() => {
    setInterfaces(null);
    getNetworkInterfaces().then((ifs) => setInterfaces(ifs));
  }, [getNetworkInterfaces]);

  useEffect(() => {
    refreshInterfaces();
  }, [refreshInterfaces]);

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

type InputSettingsDialogProps = {
  target: DialogMode['target'];
  input: InputDefinition['type'];
  close: () => void;
};

export const InputSettingsDialog: FC<InputSettingsDialogProps> = ({
  target,
  input,
  close,
}) => {
  const { config, updateConfig } = useContext(ConfigContext);
  const [newData, setNewData] = useState<InputConfig>({
    name: '',
    enabled: true,
    definition:
      input === 'artnet'
        ? {
            type: 'artnet',
            iface: '',
            port: undefined,
          }
        : {
            type: 'tcnet',
            iface: '',
          },
  });

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
        ) : null}
        <ControlLabel>Delay (ms)</ControlLabel>
        <ControlInput
          position="both"
          type="string"
          value={data.delayMs?.toString() ?? ''}
          placeholder={`Default (0ms)`}
          onChange={(value, enterPressed) => {
            const delayMs = value ? parseInt(value, 10) : undefined;
            if (delayMs !== undefined && isNaN(delayMs)) {
              return;
            }
            updateSettings((current) => ({
              ...current,
              delayMs,
            }));
            if (enterPressed) {
              commitChanges();
            }
          }}
        />
        {resolvedTarget === 'add' ? (
          <ControlDialogButtons>
            <ControlButton onClick={close} variant="large">
              Cancel
            </ControlButton>
            <ControlButton onClick={addInput} variant="large">
              Add Input
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

  return (
    <TimecodeTreeDisplay
      id={['input', uuid]}
      config={{ delayMs: config.delayMs ?? null }}
      type={STRINGS.protocols[config.definition.type].short}
      name={config.name ? [config.name] : []}
      color={config.color}
      timecode={state?.timecode ?? null}
      namePlaceholder={`Unnamed Input`}
      buttons={
        <>
          <ControlButton
            variant="large"
            title={config.enabled ? 'Stop Input' : 'Start Input'}
            onClick={toggleEnabled}
            icon={config.enabled ? 'stop' : 'play_arrow'}
          />
          <ControlButton
            variant="large"
            title="Edit Input"
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
      assignToOutput={assignToOutput}
    />
  );
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
          {(['artnet', 'tcnet'] as const).map((type) => (
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
            min-[600px]:grid-cols-2
            min-[900px]:grid-cols-3
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
