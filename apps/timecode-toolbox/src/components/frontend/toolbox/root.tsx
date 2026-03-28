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
import { ExternalLink } from './content';
import { STRINGS } from '../constants';
import { OutputSettingsDialog, OutputsSection } from './outputs';
import { GeneratorsSection } from './generators';
import { InputSettingsDialog, InputsSection } from './inputs';
import { diffJson } from '@arcanejs/diff';
import { StageContext } from '@arcanejs/toolkit-frontend';
import {
  ApplicationStateContext,
  ConfigContext,
  ConfigContextData,
  NetworkContext,
} from './context';
import { AssignToOutputCallback, DialogMode } from './types';

type Props = {
  info: ToolboxRootComponent;
};

export const ToolboxRoot: FC<Props> = ({ info }) => {
  const [debuggerOpen, setDebuggerOpen] = useState(false);
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

  return (
    <ConfigContext.Provider value={configContext}>
      <NetworkContext.Provider value={networkContextValue}>
        <ApplicationStateContext.Provider value={info.state}>
          <div className="flex h-screen flex-col">
            <ToolbarWrapper>
              <ToolbarRow>
                <div
                  className="
                    flex h-full min-h-[36px] grow items-center justify-center
                    px-1 app-title-bar
                  "
                >
                  {STRINGS.title}
                </div>
                <ToolbarDivider />
                <ControlButton
                  onClick={() => setDebuggerOpen((open) => !open)}
                  variant="titlebar"
                  icon="bug_report"
                  active={debuggerOpen}
                  title={STRINGS.toggle(STRINGS.debugger)}
                />
              </ToolbarRow>
            </ToolbarWrapper>
            <div className="relative flex h-0 grow flex-col">
              {debuggerOpen ? (
                <Debugger title={STRINGS.debugger} className="size-full" />
              ) : (
                <div
                  className="
                    flex h-0 grow flex-col gap-px overflow-y-auto
                    bg-sigil-border scrollbar-sigil
                  "
                >
                  <InputsSection
                    setDialogMode={setDialogMode}
                    assignToOutput={assignToOutputCallback}
                  />
                  <GeneratorsSection />
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
              {dialogMode?.section.type === 'outputs' && (
                <OutputSettingsDialog
                  close={closeDialog}
                  output={dialogMode.section.output}
                  target={dialogMode.target}
                />
              )}
            </div>
            <div
              className="
                flex justify-center border-t border-sigil-border
                bg-sigil-bg-dark p-1 text-[80%]
              "
            >
              {'Created by'}&nbsp;
              <ExternalLink href="https://arcanewizards.com">
                Arcane Wizards
              </ExternalLink>
            </div>
          </div>
        </ApplicationStateContext.Provider>
      </NetworkContext.Provider>
    </ConfigContext.Provider>
  );
};
