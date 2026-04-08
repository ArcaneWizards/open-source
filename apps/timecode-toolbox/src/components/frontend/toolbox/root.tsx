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
import {
  ToolbarDivider,
  ToolbarRow,
  ToolbarWrapper,
} from '@arcanewizards/sigil/frontend/toolbars';
import { ControlButton } from '@arcanewizards/sigil/frontend/controls';
import { ExternalLink, TextButton } from './content';
import { SOURCE_CODE_URL, STRINGS } from '../constants';
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
import { AssignToOutputCallback, DialogMode } from './types';
import { Settings } from './settings';
import { useBrowserPreferences } from './preferences';
import { useRootHintVariables } from '@arcanewizards/sigil/frontend/styling';
import { SizeAwareDiv } from './core/size-aware-div';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { getFragmentValue } from '../../../urls';
import { FullscreenTimecodeDisplay } from './core/timecode-display';
import { License } from './license';

type Props = {
  info: ToolboxRootComponent;
};

export const ToolboxRoot: FC<Props> = ({ info }) => {
  const [windowMode, setWindowMode] = useState<
    'debug' | 'settings' | 'license' | null
  >(null);
  const { config } = info;
  const { sendMessage, call, connection, reconnect } = useContext(StageContext);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);

  const [assignToOutput, setAssignToOutput] = useState<string | null>(null);

  const { preferences } = useBrowserPreferences();

  useRootHintVariables(preferences.color);

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

  const closeDialog = useCallback(() => setDialogMode(null), []);

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

  const isMainWindow = windowedTimecodeId === null;

  const root = useMemo(
    () => (
      <div className="flex h-screen flex-col">
        <ToolbarWrapper>
          <ToolbarRow>
            <div
              className="
                flex h-full min-h-[36px] grow items-center justify-center px-1
                app-title-bar
              "
            >
              <span className="font-bold text-hint-gradient">
                {STRINGS.title}
              </span>
            </div>
            {isMainWindow && (
              <>
                <ToolbarDivider />
                <ControlButton
                  onClick={() =>
                    setWindowMode((mode) =>
                      mode === 'license' ? null : 'license',
                    )
                  }
                  variant="titlebar"
                  icon="info"
                  active={windowMode === 'license'}
                  title={STRINGS.toggle(STRINGS.license)}
                />
                <ControlButton
                  onClick={() =>
                    setWindowMode((mode) =>
                      mode === 'settings' ? null : 'settings',
                    )
                  }
                  variant="titlebar"
                  icon="settings"
                  active={windowMode === 'settings'}
                  title={STRINGS.toggle(STRINGS.settings.title)}
                />
                <ControlButton
                  onClick={() =>
                    setWindowMode((mode) => (mode === 'debug' ? null : 'debug'))
                  }
                  variant="titlebar"
                  icon="bug_report"
                  active={windowMode === 'debug'}
                  title={STRINGS.toggle(STRINGS.debugger)}
                />
              </>
            )}
          </ToolbarRow>
        </ToolbarWrapper>
        <div className="relative flex h-0 grow flex-col">
          {connection.state !== 'connected' ? (
            <SizeAwareDiv
              className="
                flex grow flex-col items-center justify-center gap-1
                bg-sigil-bg-light p-1 text-sigil-foreground-muted
              "
            >
              <Icon icon="signal_disconnected" className="text-block-icon" />
              <div className="text-center">{STRINGS.connectionError}</div>
              <ControlButton onClick={reconnect} variant="large" icon="replay">
                {STRINGS.reconnect}
              </ControlButton>
            </SizeAwareDiv>
          ) : windowMode === 'debug' ? (
            <Debugger title={STRINGS.debugger} className="size-full" />
          ) : windowMode === 'settings' ? (
            <Settings setWindowMode={setWindowMode} />
          ) : windowMode === 'license' ? (
            <License license={info.license} setWindowMode={setWindowMode} />
          ) : windowedTimecodeId ? (
            <FullscreenTimecodeDisplay id={windowedTimecodeId} />
          ) : (
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
          )}
          {dialogMode?.section.type === 'inputs' && (
            <InputSettingsDialog
              close={closeDialog}
              input={dialogMode.section.input}
              target={dialogMode.target}
            />
          )}
          {dialogMode?.section.type === 'generators' && (
            <GeneratorSettingsDialog
              close={closeDialog}
              generator={dialogMode.section.generator}
              target={dialogMode.target}
            />
          )}
          {dialogMode?.section.type === 'outputs' && (
            <OutputSettingsDialog
              close={closeDialog}
              output={dialogMode.section.output}
              target={dialogMode.target}
            />
          )}
        </div>
        {isMainWindow && (
          <div
            className="
              flex items-center justify-center gap-1 border-t
              border-sigil-border bg-sigil-bg-dark p-1 text-[80%]
            "
          >
            <span>
              {'Created by'}&nbsp;
              <ExternalLink href="https://arcanewizards.com">
                Arcane Wizards
              </ExternalLink>
            </span>
            <ToolbarDivider />
            <ExternalLink href={SOURCE_CODE_URL}>
              {STRINGS.sourceCode}
            </ExternalLink>
            <ToolbarDivider />
            <TextButton
              onClick={() =>
                setWindowMode((mode) => (mode === 'license' ? null : 'license'))
              }
            >
              {STRINGS.license}
            </TextButton>
          </div>
        )}
      </div>
    ),
    [
      connection,
      reconnect,
      assignToOutput,
      assignToOutputCallback,
      closeDialog,
      dialogMode,
      windowMode,
      isMainWindow,
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
