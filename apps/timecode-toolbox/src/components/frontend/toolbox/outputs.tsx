import {
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { STRINGS } from '../constants';
import { PrimaryToolboxSection } from './util';
import { DialogMode, SettingsProps } from './types';
import {
  ControlButton,
  ControlColorSelect,
  ControlDialog,
  ControlDialogButtons,
  ControlInput,
  ControlLabel,
  ControlSelect,
} from '@arcanewizards/sigil/frontend/controls';
import { ConfigContext, NetworkContext, useApplicationState } from './context';
import {
  OutputConfig,
  OutputDefinition,
  TimecodeInstance,
  ToolboxRootGetNetworkInterfacesReturn,
} from '../../proto';
import { TimecodeTreeDisplay } from './core/timecode-display';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import {
  ChangeCommitContext,
  useChangeCommitBoundary,
} from '@arcanewizards/sigil/frontend/context';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { ARTNET_PORT, TimecodeMode } from '@arcanewizards/artnet/constants';
import { SizeAwareDiv } from './core/size-aware-div';
import { TooltipWrapper } from '@arcanewizards/sigil/frontend/tooltip';
import {
  cssSigilColorUsageVariables,
  sigilColorUsage,
} from '@arcanewizards/sigil/frontend/styling';
import {
  augmentUpstreamTimecodeWithOutputMetadata,
  getTimecodeInstance,
} from '../../../util';
import { NoToolboxChildren } from './content';

const DmxConnectionSettings: FC<SettingsProps<OutputDefinition>> = ({
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
      <ControlLabel>Target Type</ControlLabel>
      <ControlSelect
        value={data.target.type}
        options={[
          {
            value: 'interface',
            label: 'Broadcast',
          },
          {
            value: 'host',
            label: 'IP Address / Hostname',
          },
        ]}
        position="both"
        variant="large"
        onChange={(type) => {
          updateSettings((current) => ({
            ...current,
            target:
              type === 'interface'
                ? {
                    type: 'interface',
                    interface: '',
                  }
                : {
                    type: 'host',
                    host: 'localhost',
                  },
          }));
        }}
      />
      {data.target.type === 'interface' ? (
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
            value={data.target.interface ?? null}
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
                target: {
                  type: 'interface',
                  interface: value ?? '',
                },
              }));
            }}
            position="second"
            variant="large"
            triggerClassName={cn('text-sigil-control')}
          />
        </>
      ) : (
        <>
          <ControlLabel>Hostname / IP</ControlLabel>
          <ControlInput
            position="both"
            type="string"
            value={data.target.host ?? ''}
            onChange={(value) => {
              updateSettings((current) => ({
                ...current,
                target: {
                  type: 'host',
                  host: value,
                },
              }));
            }}
          />
        </>
      )}

      <ControlLabel>Port</ControlLabel>
      <ControlInput
        position="both"
        type="string"
        value={data.target.port?.toString() ?? ''}
        placeholder={`Default (${ARTNET_PORT})`}
        onChange={(value, enterPressed) => {
          const port = value ? parseInt(value, 10) : undefined;
          if (port !== undefined && isNaN(port)) {
            return;
          }
          updateSettings((current) => ({
            ...current,
            target: {
              ...current.target,
              port,
            },
          }));
          if (enterPressed) {
            commitChanges();
          }
        }}
      />
      <ControlLabel>FPS</ControlLabel>
      <ControlSelect<TimecodeMode>
        position="both"
        variant="large"
        value={data.mode}
        options={(
          Object.entries(STRINGS.smtpeModeOptions) as [TimecodeMode, string][]
        ).map(([mode, label]) => ({
          label,
          value: mode,
        }))}
        onChange={(mode) => {
          updateSettings((current) => ({ ...current, mode }));
        }}
      />
    </>
  );
};

type OutputSettingsDialogProps = {
  target: DialogMode['target'];
  output: OutputDefinition['type'];
  setDialogMode: (mode: DialogMode | null) => void;
};

export const OutputSettingsDialog: FC<OutputSettingsDialogProps> = ({
  target,
  output,
  setDialogMode,
}) => {
  const { config, updateConfig } = useContext(ConfigContext);
  const [newData, setNewData] = useState<OutputConfig>({
    name: '',
    enabled: true,
    definition: {
      type: 'artnet',
      target: {
        type: 'host',
        host: 'localhost',
      },
      mode: 'SMPTE',
    },
    link: null,
  });

  const close = useCallback(() => setDialogMode(null), [setDialogMode]);

  const updateSettings: SettingsProps<OutputConfig>['updateSettings'] =
    useCallback(
      (change) => {
        if (target.type === 'add') {
          setNewData(change);
        } else {
          updateConfig((current) => {
            const existing = current.outputs?.[target.uuid];
            if (!existing) {
              return current;
            }
            return {
              ...current,
              outputs: {
                ...current.outputs,
                [target.uuid]: change(existing),
              },
            };
          });
        }
      },
      [target, updateConfig],
    );

  const updateDefinition = useCallback(
    (change: (current: OutputDefinition) => OutputDefinition) => {
      updateSettings((current) => ({
        ...current,
        definition: change(current.definition),
      }));
    },
    [updateSettings],
  );

  const addOutput = useCallback(() => {
    updateConfig((current) => {
      return {
        ...current,
        outputs: {
          ...current.outputs,
          [uuidv4()]: newData,
        },
      };
    });
    close();
  }, [newData, close, updateConfig]);

  const resolvedTarget =
    target.type === 'add' ? 'add' : config.outputs?.[target.uuid];

  const data = resolvedTarget === 'add' ? newData : resolvedTarget;

  const commitChanges = useCallback(() => {
    if (target.type === 'add') {
      addOutput();
    } else {
      close();
    }
  }, [target, addOutput, close]);

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
            ? STRINGS.outputs.addDialog(STRINGS.protocols[output].short)
            : STRINGS.outputs.editDialog(
                STRINGS.protocols[output].short,
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
        {target.type === 'add' ? (
          <ControlDialogButtons>
            <ControlButton onClick={close} variant="large">
              Cancel
            </ControlButton>
            <ControlButton onClick={addOutput} variant="large">
              Add Output
            </ControlButton>
          </ControlDialogButtons>
        ) : target.type === 'edit' ? (
          <ControlDialogButtons>
            <ControlButton
              onClick={() =>
                setDialogMode({
                  section: { type: 'outputs', output },
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

type OutputDisplayProps = {
  uuid: string;
  config: OutputConfig;
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: string | null;
  setAssignToOutput: Dispatch<SetStateAction<string | null>>;
};

const OutputDisplay: FC<OutputDisplayProps> = ({
  uuid,
  config,
  setDialogMode,
  assignToOutput,
  setAssignToOutput,
}) => {
  const applicationState = useApplicationState();
  const { updateConfig } = useContext(ConfigContext);
  const clearLink = useCallback(() => {
    updateConfig((current) => {
      const currentOutput = current.outputs?.[uuid];
      if (!currentOutput) {
        return current;
      }
      return {
        ...current,
        outputs: {
          ...current.outputs,
          [uuid]: {
            ...currentOutput,
            link: null,
          },
        },
      };
    });
    setAssignToOutput(null);
  }, [updateConfig, uuid, setAssignToOutput]);

  const linkCallback = useCallback(
    () => setAssignToOutput((current) => (current === uuid ? null : uuid)),
    [uuid, setAssignToOutput],
  );

  const timecode: TimecodeInstance = useMemo(() => {
    const tc =
      config.link && getTimecodeInstance(applicationState, config.link);
    return augmentUpstreamTimecodeWithOutputMetadata(tc, config);
  }, [applicationState, config]);

  const toggleEnabled = useCallback(() => {
    updateConfig((current) => {
      const existing = current.outputs?.[uuid];
      if (!existing) {
        return current;
      }
      return {
        ...current,
        outputs: {
          ...current.outputs,
          [uuid]: {
            ...existing,
            enabled: !existing.enabled,
          },
        },
      };
    });
  }, [uuid, updateConfig]);

  return (
    <div
      className="relative flex flex-col"
      style={
        config.color &&
        cssSigilColorUsageVariables(
          'timecode-usage',
          sigilColorUsage(config.color),
        )
      }
    >
      <TimecodeTreeDisplay
        id={['output', uuid]}
        config={{ delayMs: config.delayMs ?? null }}
        assignToOutput={null}
        type={STRINGS.protocols[config.definition.type].short}
        name={config.name ? [config.name] : []}
        color={config.color}
        timecode={config.enabled ? timecode : null}
        namePlaceholder={`Unnamed Output`}
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
              title="Link Output"
              active={assignToOutput === uuid}
              onClick={linkCallback}
              icon={config.link ? 'link' : 'link_off'}
            />
            <ControlButton
              variant="large"
              title="Edit Output"
              onClick={() =>
                setDialogMode({
                  section: { type: 'outputs', output: config.definition.type },
                  target: { type: 'edit', uuid },
                })
              }
              icon="edit"
            />
          </>
        }
      />
      {assignToOutput === uuid && config.link && (
        <SizeAwareDiv className="absolute inset-0" onClick={clearLink}>
          <TooltipWrapper tooltip="Unlink from Input / Generator">
            <div
              className="
                flex size-full cursor-pointer flex-col items-center
                justify-center gap-0.5 bg-timecode-backdrop
                text-timecode-usage-text
                hover:bg-timecode-backdrop-hover
              "
            >
              <Icon icon="link_off" className="text-block-icon" />
              <p>Press ESC to cancel</p>
            </div>
          </TooltipWrapper>
        </SizeAwareDiv>
      )}
    </div>
  );
};

export type OutputSectionProps = {
  setDialogMode: (mode: DialogMode | null) => void;
  assignToOutput: string | null;
  setAssignToOutput: Dispatch<SetStateAction<string | null>>;
};

export const OutputsSection: FC<OutputSectionProps> = ({
  setDialogMode,
  assignToOutput,
  setAssignToOutput,
}) => {
  const { config } = useContext(ConfigContext);
  return (
    <PrimaryToolboxSection
      title={STRINGS.outputs.title}
      buttons={
        <>
          {(['artnet'] as const).map((type) => (
            <ControlButton
              key={type}
              onClick={() =>
                setDialogMode({
                  section: { type: 'outputs', output: type },
                  target: { type: 'add' },
                })
              }
              variant="toolbar"
              icon="add"
            >
              {STRINGS.outputs.addButton(STRINGS.protocols[type].long)}
            </ControlButton>
          ))}
        </>
      }
    >
      {Object.entries(config.outputs ?? {}).length === 0 ? (
        <NoToolboxChildren text={STRINGS.outputs.noChildren} />
      ) : (
        <div
          className="
            grid grow grid-cols-1 gap-px
            min-[600px]:grid-cols-2
            min-[900px]:grid-cols-3
          "
        >
          {Object.entries(config.outputs).map(([uuid, output]) => (
            <OutputDisplay
              key={uuid}
              uuid={uuid}
              config={output}
              setDialogMode={setDialogMode}
              assignToOutput={assignToOutput}
              setAssignToOutput={setAssignToOutput}
            />
          ))}
        </div>
      )}
    </PrimaryToolboxSection>
  );
};
