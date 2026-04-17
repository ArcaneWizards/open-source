import { Debugger } from '@arcanewizards/sigil/frontend';
import {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  TIMECODE_INSTANCE_ID,
  TimecodeToolboxComponentCalls,
  ToolboxConfig,
  ToolboxRootComponent,
  ToolboxRootConfigUpdate,
} from '../../proto';

import { STRINGS } from '../constants';
import { OutputSettingsDialog, OutputsSection } from './outputs';
import { GeneratorSettingsDialog, GeneratorsSection } from './generators';
import { InputSettingsDialog, InputsSection } from './inputs';
import { diffJson } from '@arcanejs/diff';
import { StageContext } from '@arcanejs/toolkit-frontend';
import {
  ApplicationHandlersContext,
  ApplicationHandlersContextData,
  ApplicationStateContext,
  ConfigContext,
  ConfigContextData,
  NetworkContext,
} from './context';
import {
  AssignToOutputCallback,
  DialogMode,
  DialogModeDelete,
  isDeleteDialogMode,
} from './types';
import { Settings } from './settings';
import { getFragmentValue } from '../../../urls';
import { FullscreenTimecodeDisplay } from './core/timecode-display';
import { License } from './license';
import { Layout } from './core/layout';
import { UpdateBanner } from './core/updates';
import {
  ControlDialog,
  ControlDialogButtons,
} from '../../../../../../packages/sigil/src/frontend/controls/dialogs';
import {
  ControlButton,
  ControlDetails,
} from '@arcanewizards/sigil/frontend/controls';

type Props = {
  info: ToolboxRootComponent;
};

const DeleteConfirmationDialog: FC<{
  dialogMode: DialogModeDelete;
  setDialogMode: (mode: DialogMode | null) => void;
}> = ({ dialogMode, setDialogMode }) => {
  const { updateConfig } = useContext(ConfigContext);

  const deleteTarget = useCallback(() => {
    updateConfig((current) => {
      return {
        ...current,
        [dialogMode.section.type]: Object.fromEntries(
          Object.entries(current[dialogMode.section.type]).filter(
            ([uuid]) => uuid !== dialogMode.target.uuid,
          ),
        ),
      };
    });
    setDialogMode(null);
  }, [updateConfig, dialogMode, setDialogMode]);

  return (
    <ControlDialog
      dialogClosed={() => setDialogMode(null)}
      title={STRINGS[dialogMode.section.type].deleteDialog}
    >
      <ControlDetails position="row">
        {STRINGS[dialogMode.section.type].deleteDialogDetails}
      </ControlDetails>
      <ControlDialogButtons>
        <ControlButton onClick={() => setDialogMode(null)} variant="large">
          Cancel
        </ControlButton>
        <ControlButton
          onClick={deleteTarget}
          variant="large"
          destructive
          icon="delete"
        >
          Delete
        </ControlButton>
      </ControlDialogButtons>
    </ControlDialog>
  );
};

export const ToolboxRoot: FC<Props> = ({ info }) => {
  const { config } = info;
  const { sendMessage, call } = useContext(StageContext);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);

  const [assignToOutput, setAssignToOutput] = useState<string | null>(null);

  useEffect(() => {
    if (assignToOutput) {
      const onEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setAssignToOutput(null);
        }
      };
      window.addEventListener('keydown', onEscape);
      return () => {
        window.removeEventListener('keydown', onEscape);
      };
    }
  }, [assignToOutput]);

  const updateConfig = useCallback(
    (change: (current: ToolboxConfig) => ToolboxConfig) => {
      const diff = diffJson(config, change(config));
      sendMessage?.<ToolboxRootConfigUpdate>({
        type: 'component-message',
        namespace: 'timecode-toolbox',
        component: 'toolbox-root',
        componentKey: info.key,
        action: 'update-config',
        diff,
      });
    },
    [sendMessage, info.key, config],
  );

  const configContext: ConfigContextData = useMemo(
    () => ({
      config,
      updateConfig,
    }),
    [config, updateConfig],
  );

  const getNetworkInterfaces = useCallback(async () => {
    if (!call) {
      throw new Error('No call function available');
    }
    return call<
      'timecode-toolbox',
      TimecodeToolboxComponentCalls,
      'toolbox-root-get-network-interfaces'
    >({
      namespace: 'timecode-toolbox',
      type: 'component-call',
      componentKey: info.key,
      action: 'toolbox-root-get-network-interfaces',
    });
  }, [call, info.key]);

  const networkContextValue = useMemo(() => {
    return {
      getNetworkInterfaces,
    };
  }, [getNetworkInterfaces]);

  const assignToOutputCallback: AssignToOutputCallback = useMemo(() => {
    if (!assignToOutput) {
      return null;
    }
    const outputUuid = assignToOutput;
    return (id) => {
      updateConfig((current) => {
        const output = current.outputs[outputUuid];
        if (!output) {
          return current;
        }
        return {
          ...current,
          outputs: {
            ...current.outputs,
            [outputUuid]: {
              ...output,
              link: id,
            },
          },
        };
      });
      setAssignToOutput(null);
    };
  }, [assignToOutput, updateConfig]);

  const callHandler: ApplicationHandlersContextData['callHandler'] =
    useCallback(
      async ({ path, handler, args }) => {
        if (!call) {
          throw new Error('No call function available');
        }
        return call<
          'timecode-toolbox',
          TimecodeToolboxComponentCalls,
          'toolbox-root-call-handler'
        >({
          namespace: 'timecode-toolbox',
          type: 'component-call',
          componentKey: info.key,
          action: 'toolbox-root-call-handler',
          handler,
          path,
          args,
        });
      },
      [call, info.key],
    );

  const handlers: ApplicationHandlersContextData = useMemo(
    () => ({
      handlers: info.handlers,
      callHandler,
    }),
    [info.handlers, callHandler],
  );

  const windowedTimecodeId = useMemo(
    () => getFragmentValue('tc', TIMECODE_INSTANCE_ID),
    [],
  );

  const root = useMemo(
    () =>
      windowedTimecodeId ? (
        <Layout modes={null}>
          <FullscreenTimecodeDisplay id={windowedTimecodeId} />
        </Layout>
      ) : (
        <>
          <Layout<'debug' | 'license' | 'settings'>
            footer
            modes={{
              license: {
                child: (setWindowMode) => (
                  <License
                    license={info.license}
                    setWindowMode={setWindowMode}
                  />
                ),
                icon: 'info',
                title: STRINGS.license,
              },
              settings: {
                child: (setWindowMode) => (
                  <Settings setWindowMode={setWindowMode} />
                ),
                icon: 'settings',
                title: STRINGS.settings.title,
              },
              debug: {
                child: () => (
                  <Debugger title={STRINGS.debugger} className="size-full" />
                ),
                icon: 'bug_report',
                title: STRINGS.debugger,
              },
            }}
            licenseMode="license"
          >
            <>
              <UpdateBanner />
              <div
                className="
                  flex h-0 grow flex-col gap-px overflow-y-auto bg-sigil-border
                  scrollbar-sigil
                "
              >
                <InputsSection
                  setDialogMode={setDialogMode}
                  assignToOutput={assignToOutputCallback}
                />
                <GeneratorsSection
                  setDialogMode={setDialogMode}
                  assignToOutput={assignToOutputCallback}
                />
                <OutputsSection
                  setDialogMode={setDialogMode}
                  assignToOutput={assignToOutput}
                  setAssignToOutput={setAssignToOutput}
                />
              </div>
            </>
          </Layout>
          {isDeleteDialogMode(dialogMode) ? (
            <DeleteConfirmationDialog
              dialogMode={dialogMode}
              setDialogMode={setDialogMode}
            />
          ) : (
            <>
              {dialogMode?.section.type === 'inputs' && (
                <InputSettingsDialog
                  setDialogMode={setDialogMode}
                  input={dialogMode.section.input}
                  target={dialogMode.target}
                />
              )}
              {dialogMode?.section.type === 'generators' && (
                <GeneratorSettingsDialog
                  setDialogMode={setDialogMode}
                  generator={dialogMode.section.generator}
                  target={dialogMode.target}
                />
              )}
              {dialogMode?.section.type === 'outputs' && (
                <OutputSettingsDialog
                  setDialogMode={setDialogMode}
                  output={dialogMode.section.output}
                  target={dialogMode.target}
                />
              )}
            </>
          )}
        </>
      ),
    [
      assignToOutput,
      assignToOutputCallback,
      dialogMode,
      windowedTimecodeId,
      info.license,
    ],
  );

  return (
    <ConfigContext.Provider value={configContext}>
      <NetworkContext.Provider value={networkContextValue}>
        <ApplicationStateContext.Provider value={info.state}>
          <ApplicationHandlersContext.Provider value={handlers}>
            {root}
          </ApplicationHandlersContext.Provider>
        </ApplicationStateContext.Provider>
      </NetworkContext.Provider>
    </ConfigContext.Provider>
  );
};
