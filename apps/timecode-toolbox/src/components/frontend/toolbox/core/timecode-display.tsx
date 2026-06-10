import {
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  isTimecodeGroup,
  isTimecodeInstance,
  TimecodeGroup,
  TimecodeInstance,
  TimecodeState,
  TimecodeTotalTime,
  TimecodeInstanceId,
  isOutputInstanceId,
  isInputInstanceId,
  isGeneratorInstanceId,
  ToolboxConfig,
  UniversalConfig,
  MidiTargetConfig,
  GeneratorPlayerDefinition,
  UniversalConfigWithDefinition,
  isAudioPlayerGenerator,
} from '../../../proto';
import { displayMillis } from '../util';
import { StageContext } from '@arcanejs/toolkit-frontend';
import {
  cnd,
  cssSigilColorUsageVariables,
  SigilColor,
  sigilColorUsage,
} from '@arcanewizards/sigil/frontend/styling';
import { cn } from '@arcanejs/toolkit-frontend/util';
import {
  ControlButton,
  ControlButtonGroup,
} from '@arcanewizards/sigil/frontend/controls';
import { TooltipWrapper } from '@arcanewizards/sigil/frontend/tooltip';
import { STRINGS } from '../../constants';
import { AssignToOutputCallback } from '../types';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { SizeAwareDiv } from './size-aware-div';
import {
  ApplicationStateContext,
  ConfigContext,
  useApplicationHandlers,
  useGlobalUserInteractions,
} from '../context';
import { getTreeValue } from '../../../../tree';
import { useBrowserContext } from '@arcanewizards/sigil/frontend';
import { WINDOW_MODE_TIMECODE, withUrlFragment } from '../../../../urls';
import {
  augmentUpstreamTimecodeWithOutputMetadata,
  getTimecodeInstance,
} from '../../../../util';
import { LoadFileCallback, WithAudioPlayer } from './audio-player';
import { useNetworkInterfaceInfo } from '../hooks';
import {
  AudioPlaybackContext,
  AudioPlaybackContextProvider,
  AudioRecordingContext,
} from './audio-context';
import { LtcContext, WithLtcPlayer } from './ltc-player';

type ActiveTimecodeTextProps = {
  effectiveStartTimeMillis: number;
  speed: number;
};

const ActiveTimecodeText: FC<ActiveTimecodeTextProps> = ({
  effectiveStartTimeMillis,
  speed,
}) => {
  const [millis, setMillis] = useState(0);

  const { timeDifferenceMs } = useContext(StageContext);

  useEffect(() => {
    let animationFrame: number | null = null;

    const updateMillis = () => {
      const newMillis =
        (Date.now() - (timeDifferenceMs ?? 0) - effectiveStartTimeMillis) *
        speed;
      setMillis(newMillis);
      animationFrame = requestAnimationFrame(updateMillis);
    };
    updateMillis();
    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [effectiveStartTimeMillis, speed, timeDifferenceMs]);

  return displayMillis(millis);
};

type TimelineProps = {
  state: TimecodeState;
  totalTime: TimecodeTotalTime;
  seekAbsolute: null | ((positionMillis: number) => void);
};

const Timeline: FC<TimelineProps> = ({ state, totalTime, seekAbsolute }) => {
  const [millis, setMillis] = useState(0);

  const { timeDifferenceMs } = useContext(StageContext);

  useEffect(() => {
    if (state.state === 'none' || state.state === 'unloaded') {
      setMillis(0);
      return;
    }

    if (state.state === 'stopped') {
      setMillis(state.positionMillis + state.appliedDelayMillis);
      return;
    }

    let animationFrame: number | null = null;

    const updateMillis = () => {
      const newMillis =
        (Date.now() -
          (timeDifferenceMs ?? 0) -
          state.effectiveStartTimeMillis) *
          state.speed +
        state.appliedDelayMillis;
      setMillis(Math.max(0, newMillis));
      animationFrame = requestAnimationFrame(updateMillis);
    };
    updateMillis();
    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [state, timeDifferenceMs]);

  const ref = useRef<HTMLDivElement>(null);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (seekAbsolute) {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) {
          const clickPosition = e.clientX - rect.left;
          const positionMillis =
            (clickPosition / rect.width) * totalTime.timeMillis;
          seekAbsolute(positionMillis);
        }
      }
    },
    [seekAbsolute, totalTime],
  );

  return (
    <div
      ref={ref}
      className={cn(
        'group w-full border border-timecode-usage-foreground p-px',
        cnd(
          seekAbsolute,
          `
            cursor-crosshair
            hover:border-timecode-usage-selected-border
          `,
        ),
      )}
      onClick={onClick}
    >
      <div className="relative h-1 w-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 bg-timecode-usage-foreground',
            cnd(seekAbsolute, 'group-hover:bg-timecode-usage-selected-border'),
          )}
          style={{
            width: `${Math.min((millis / totalTime.timeMillis) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
};

export type TimecodeDisplayProps = {
  id: TimecodeInstanceId;
  timecode: TimecodeInstance;
  config: UniversalConfig;
  headerComponents?: React.ReactNode;
  disabled: boolean;
  rootState: {
    errors: string[];
    warnings: string[];
  };
  loadFile: null | LoadFileCallback;
  startPlayer: null | (() => void);
};

const TimecodeDisplay: FC<TimecodeDisplayProps> = ({
  id,
  timecode: { state, metadata },
  config,
  headerComponents,
  disabled,
  rootState,
  loadFile,
  startPlayer,
}) => {
  const { handlers, callHandler } = useApplicationHandlers();

  const hooks = id && getTreeValue(handlers, id);

  const play = useCallback(() => {
    if (id) {
      callHandler({ handler: 'play', path: id, args: [] });
    }
  }, [callHandler, id]);

  const pause = useCallback(() => {
    if (id) {
      callHandler({ handler: 'pause', path: id, args: [] });
    }
  }, [callHandler, id]);

  const back5seconds = useCallback(() => {
    if (id) {
      callHandler({ handler: 'seekRelative', path: id, args: [-5000] });
    }
  }, [callHandler, id]);

  const forward5seconds = useCallback(() => {
    if (id) {
      callHandler({ handler: 'seekRelative', path: id, args: [5000] });
    }
  }, [callHandler, id]);

  const seekAbsolute = useCallback(
    (positionMillis: number) => {
      if (id) {
        callHandler({
          handler: 'seekAbsolute',
          path: id,
          args: [positionMillis],
        });
      }
    },
    [callHandler, id],
  );

  const beginning = useCallback(() => {
    if (id) {
      callHandler({ handler: 'beginning', path: id, args: [] });
    }
  }, [callHandler, id]);

  const fileRef = useRef<HTMLInputElement>(null);

  const ltc = useContext(LtcContext);

  const clickAction = useMemo(() => {
    if (!disabled && hooks?.play && hooks?.pause) {
      return () => {
        if (state.state === 'none' || state.state === 'stopped') {
          play();
        } else {
          pause();
        }
      };
    } else if (state.state === 'none' && loadFile) {
      return () => {
        fileRef.current?.click();
      };
    } else if (state.state === 'unloaded' && startPlayer) {
      return startPlayer;
    } else if (!disabled && ltc?.state === null && ltc) {
      return ltc.startLtcPlayback;
    }
  }, [hooks, play, pause, state.state, loadFile, startPlayer, disabled, ltc]);

  const [isDroppingFile, setIsDroppingFile] = useState(false);

  type DragEvents = {
    onDragEnter: React.DragEventHandler;
    onDragLeave: React.DragEventHandler;
    onDragOver: React.DragEventHandler;
    onDrop: React.DragEventHandler;
  };

  const dropEvents: DragEvents | null = useMemo(() => {
    if (!loadFile) {
      return null;
    }

    return {
      onDragEnter: (e) => {
        e.preventDefault();
        setIsDroppingFile(true);
      },
      onDragLeave: (e) => {
        e.preventDefault();
        setIsDroppingFile(false);
      },
      onDragOver: (e) => {
        e.preventDefault();
        setIsDroppingFile(true);
      },
      onDrop: (e) => {
        e.preventDefault();
        setIsDroppingFile(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          if (e.dataTransfer.files[0]) {
            loadFile(e.dataTransfer.files[0]);
          }
          e.dataTransfer.clearData();
        }
      },
    } satisfies DragEvents;
  }, [loadFile]);

  const { draggingFileIntoWindow } = useGlobalUserInteractions();

  const errors = useMemo(
    () => [...rootState.errors, ...(ltc?.errors || [])],
    [rootState.errors, ltc],
  );

  return (
    <div className="flex grow flex-col gap-px">
      {loadFile && (
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          accept="audio/*,audio/aac,audio/wav,audio/ogg,.flac,audio/mpeg,audio/webm"
        />
      )}
      <div
        className={cn(
          'flex grow flex-col p-0.5',
          cnd(
            state?.state === 'lagging',
            'bg-sigil-usage-red-background text-sigil-usage-red-text',
            'bg-sigil-bg-light text-timecode-usage-foreground',
          ),
        )}
      >
        {headerComponents && (
          <div className="flex gap-0.25">{headerComponents}</div>
        )}
        <SizeAwareDiv
          className="relative min-h-timecode-min-height grow"
          onClick={clickAction}
        >
          <div
            className={cn(
              'group absolute inset-0 flex items-center justify-center',
              cnd(state?.state === 'stopped', 'opacity-50'),
              cnd(
                clickAction,
                `
                  cursor-pointer
                  hover:opacity-100
                `,
              ),
              cnd(
                state.state === 'none' && dropEvents && !isDroppingFile,
                'opacity-50',
              ),
              cnd(ltc?.state === null && ltc, 'opacity-50'),
              cnd(isDroppingFile, 'opacity-100'),
            )}
            {...dropEvents}
          >
            {dropEvents && draggingFileIntoWindow && (
              <div
                className={cn(
                  `
                    absolute inset-1 z-10 border-4 border-dotted
                    border-timecode-usage-border
                  `,
                )}
              />
            )}
            <span className="font-mono text-timecode-adaptive">
              {disabled ? (
                <Icon icon="pause" className="text-timecode-adaptive" />
              ) : ltc?.state === null && ltc ? (
                <Icon icon="cable" className="text-timecode-adaptive" />
              ) : state.state === 'none' ? (
                loadFile ? (
                  <Icon icon="file_open" className="text-timecode-adaptive" />
                ) : (
                  displayMillis(null)
                )
              ) : state.state === 'unloaded' ? (
                startPlayer ? (
                  <Icon icon="play_arrow" className="text-timecode-adaptive" />
                ) : (
                  displayMillis(null)
                )
              ) : state.state === 'stopped' ? (
                displayMillis(state.positionMillis)
              ) : (
                <ActiveTimecodeText
                  effectiveStartTimeMillis={state.effectiveStartTimeMillis}
                  speed={state.speed}
                />
              )}
            </span>
          </div>
        </SizeAwareDiv>
        {hooks?.pause || hooks?.play ? (
          <div className="flex justify-center gap-px">
            {hooks.beginning && (
              <ControlButton
                onClick={beginning}
                variant="large"
                icon="skip_previous"
                disabled={!hooks?.beginning}
                title={STRINGS.controls.beginning}
                className="text-timecode-usage-foreground!"
              />
            )}
            {hooks.seekRelative && (
              <ControlButton
                onClick={back5seconds}
                variant="large"
                icon="replay_5"
                disabled={!hooks?.seekRelative}
                title={STRINGS.controls.back5seconds}
                className="text-timecode-usage-foreground!"
              />
            )}
            {state.state === 'none' || state.state === 'stopped' ? (
              <ControlButton
                onClick={play}
                variant="large"
                icon="play_arrow"
                disabled={!hooks?.play}
                title={STRINGS.controls.play}
                className="text-timecode-usage-foreground!"
              />
            ) : (
              <ControlButton
                onClick={pause}
                variant="large"
                icon="pause"
                disabled={!hooks?.pause}
                title={STRINGS.controls.pause}
                className="text-timecode-usage-foreground!"
              />
            )}
            {hooks.seekRelative && (
              <ControlButton
                onClick={forward5seconds}
                variant="large"
                icon="forward_5"
                disabled={!hooks?.seekRelative}
                title={STRINGS.controls.forward5seconds}
                className="text-timecode-usage-foreground!"
              />
            )}
          </div>
        ) : null}
        {metadata?.totalTime && (
          <Timeline
            state={state}
            totalTime={metadata.totalTime}
            seekAbsolute={hooks?.seekAbsolute ? seekAbsolute : null}
          />
        )}
      </div>
      {(state.smpteMode !== null ||
        state.accuracyMillis !== null ||
        (config.delayMs !== null && config.delayMs !== undefined)) && (
        <div className="flex gap-px">
          {config.delayMs !== null &&
            config.delayMs !== undefined &&
            config.delayMs !== 0 && (
              <div className="grow basis-0 truncate bg-sigil-bg-light p-0.5">
                <span
                  className={cn(
                    cnd(
                      config.delayMs < 0,
                      'line-through opacity-50',
                      'font-bold',
                    ),
                  )}
                >
                  {STRINGS.delay.delayLabel}
                </span>
                {' / '}
                <span
                  className={cn(
                    cnd(
                      config.delayMs > 0,
                      'line-through opacity-50',
                      'font-bold',
                    ),
                  )}
                >
                  {STRINGS.delay.offsetLabel}
                </span>
                {`: ${displayMillis(Math.abs(config.delayMs))}`}
              </div>
            )}
          {state.smpteMode !== null && (
            <div className="grow basis-0 truncate bg-sigil-bg-light p-0.5">
              {STRINGS.smtpeModes[state.smpteMode]}
            </div>
          )}
          {state.accuracyMillis !== null && (
            <div className="grow basis-0 truncate bg-sigil-bg-light p-0.5">
              {STRINGS.accuracy(state.accuracyMillis)}
            </div>
          )}
        </div>
      )}
      {metadata?.artist || metadata?.title ? (
        <TooltipWrapper
          tooltip={
            <>
              {metadata.title && (
                <div>
                  <span className="font-bold">Title:</span> {metadata.title}
                </div>
              )}
              {metadata.artist && (
                <div>
                  <span className="font-bold">Artist:</span> {metadata.artist}
                </div>
              )}
            </>
          }
        >
          <div className="flex gap-px">
            {metadata.title && (
              <div className="grow truncate bg-sigil-bg-light p-0.5 font-bold">
                {metadata.title}
              </div>
            )}
            {metadata.artist && (
              <div className="grow truncate bg-sigil-bg-light p-0.5">
                {metadata.artist}
              </div>
            )}
          </div>
        </TooltipWrapper>
      ) : null}
      {errors.length > 0 && (
        <div className="flex gap-px">
          {errors.map((error, index) => (
            <div
              key={index}
              className="
                grow truncate bg-sigil-usage-red-background p-0.5
                text-sigil-usage-red-text
              "
            >
              {error}
            </div>
          ))}
        </div>
      )}
      {rootState.warnings.length > 0 && (
        <div className="flex gap-px">
          {rootState.warnings.map((warning, index) => (
            <div
              key={index}
              className="
                grow truncate bg-sigil-usage-orange-background p-0.5
                text-sigil-usage-orange-text
              "
            >
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export type LinkedSourceInfo = {
  color: SigilColor | undefined;
  type: string;
  name: string[];
  namePlaceholder: string;
};

export const getLinkedSourceInfo = (
  link: TimecodeInstanceId | null,
  config: ToolboxConfig,
): LinkedSourceInfo | undefined => {
  if (!link) {
    return undefined;
  }

  let info: LinkedSourceInfo | undefined = undefined;
  if (link[0] === 'input') {
    const input = config.inputs?.[link[1]];
    if (input) {
      info = {
        color: input.color,
        type: STRINGS.protocols[input.definition.type].short,
        name: input.name ? [input.name] : [],
        namePlaceholder: STRINGS.inputs.unnamed,
      };
    }
    // TODO: Handle timecode groups and nested names
  } else if (link[0] === 'generator') {
    const generator = config.generators?.[link[1]];
    if (generator) {
      info = {
        color: generator.color,
        type: STRINGS.generators.type[generator.definition.type],
        name: generator.name ? [generator.name] : [],
        namePlaceholder: STRINGS.generators.unnamed,
      };
    }
    // TODO: Handle timecode groups and nested names
  }

  return info;
};

/**
 * Additional labels / metadata that can be displayed on a timecode instance,
 * such as network information or other config.
 */
type TimecodeLabel = {
  text: string;
};

type TimecodeTreeDisplayProps = {
  config: UniversalConfig;
  /**
   * Outputs will not have this set, inputs and generators will.
   */
  id: TimecodeInstanceId;
  type: string;
  name: string[];
  link?: LinkedSourceInfo;
  color: SigilColor | undefined;
  timecode: 'disabled' | TimecodeGroup | TimecodeInstance | null;
  rootState: TimecodeDisplayProps['rootState'];
  namePlaceholder: string;
  buttons: ReactNode;
  labels: TimecodeLabel[];
  /**
   * If set, calling this will assign the instance to the given output on
   */
  assignToOutput: AssignToOutputCallback;
  /**
   * If it's possible to load a file into this timecode instance,
   * the callback should be provided here.
   */
  loadFile: TimecodeDisplayProps['loadFile'];
  startPlayer: TimecodeDisplayProps['startPlayer'];
};

const EMPTY_TIMECODE: TimecodeInstance = {
  name: null,
  state: {
    state: 'none',
    accuracyMillis: null,
    smpteMode: null,
    onAir: null,
    appliedDelayMillis: 0,
  },
  metadata: null,
};

const extendId = <T extends TimecodeInstanceId>(id: T, key: string): T => {
  return [id[0], ...id.slice(1), key] as unknown as T;
};

export const TimecodeTreeDisplay: FC<TimecodeTreeDisplayProps> = ({
  config,
  id,
  type,
  name,
  link,
  color,
  timecode,
  rootState,
  namePlaceholder,
  buttons,
  labels,
  assignToOutput,
  loadFile,
  startPlayer,
}) => {
  const { openNewWidow } = useBrowserContext();

  const {
    openOutputDeviceDialog,
    currentVolume: currentOutputVolume,
    outputDevice,
    outputChannel,
  } = useContext(AudioPlaybackContext);

  const { openInputDeviceDialog, inputDevice, inputChannel } = useContext(
    AudioRecordingContext,
  );

  const openInNewWindow = useCallback(() => {
    if (id) {
      openNewWidow(withUrlFragment({ values: { tc: id } }).href, {
        canUseExisting: false,
        mode: WINDOW_MODE_TIMECODE,
      });
    }
  }, [id, openNewWidow]);

  const { handlers, callHandler } = useApplicationHandlers();
  const hooks = id && getTreeValue(handlers, id);

  const ltc = useContext(LtcContext);

  const closeOrClear = useMemo(() => {
    // LTC
    if (ltc?.state) {
      return {
        tooltip: STRINGS.ltc.disconnectPlayer,
        call: () => {
          ltc.release();
        },
      };
    }
    // Music Player
    if (timecode === 'disabled' || !loadFile || !isTimecodeInstance(timecode)) {
      return null;
    }
    if (timecode.state.state === 'none') {
      // No file is loaded
      return null;
    }
    if (hooks?.clear) {
      return {
        tooltip: STRINGS.clearFile,
        call: () => {
          callHandler({ handler: 'clear', path: id, args: [] });
        },
      };
    }
    return {
      tooltip: STRINGS.clearFile,
      call: () => {
        loadFile(null);
      },
    };
  }, [timecode, ltc, loadFile, callHandler, id, hooks]);

  const audioChannel = outputChannel ?? inputChannel;
  const audioDevice = outputDevice ?? inputDevice;

  const allLabels = useMemo(
    () => [
      ...labels,
      ...(audioChannel !== null
        ? [{ text: STRINGS.audio.channel(audioChannel) }]
        : []),
      ...(audioDevice ? [{ text: STRINGS.audio.device(audioDevice) }] : []),
    ],
    [labels, audioDevice, audioChannel],
  );

  name =
    timecode !== 'disabled' && timecode?.name ? [...name, timecode.name] : name;
  if (
    timecode !== 'disabled' &&
    isTimecodeGroup(timecode) &&
    Object.values(timecode.timecodes).length
  ) {
    return Object.entries(timecode.timecodes).map(([key, child]) => (
      <TimecodeTreeDisplay
        config={config}
        id={extendId(id, key)}
        key={key}
        type={type}
        name={name}
        color={timecode.color ?? color}
        timecode={child}
        rootState={rootState}
        namePlaceholder={namePlaceholder}
        buttons={buttons}
        labels={labels}
        assignToOutput={assignToOutput}
        loadFile={loadFile}
        startPlayer={startPlayer}
      />
    ));
  }

  return (
    <div
      className="relative flex grow flex-col text-timecode-usage-foreground"
      style={
        color &&
        cssSigilColorUsageVariables('timecode-usage', sigilColorUsage(color))
      }
    >
      <TimecodeDisplay
        id={id}
        timecode={
          timecode !== 'disabled' && isTimecodeInstance(timecode)
            ? timecode
            : EMPTY_TIMECODE
        }
        rootState={rootState}
        disabled={timecode === 'disabled'}
        config={config}
        loadFile={loadFile}
        startPlayer={startPlayer}
        headerComponents={
          <>
            <div className="flex grow basis-0 items-start gap-0.25">
              <div className="relative grow">
                <div className="absolute inset-x-0 top-0">
                  <div className="flex items-center gap-0.25 truncate">
                    <span
                      className="
                        m-0.25 rounded-md border border-sigil-bg-light
                        bg-timecode-usage-foreground px-1 py-0.25
                        text-sigil-control text-timecode-usage-text
                      "
                    >
                      {type}
                    </span>
                    {name.length ? (
                      <TooltipWrapper tooltip={name.join(' / ')}>
                        <span className="truncate p-0.5 font-bold">
                          {name.join(' / ')}
                        </span>
                      </TooltipWrapper>
                    ) : null}
                    {allLabels.map((label, index) => (
                      <TooltipWrapper key={index} tooltip={label.text}>
                        <span
                          key={index}
                          className="
                            m-0.25 truncate rounded-md border
                            border-sigil-bg-light bg-sigil-foreground-muted px-1
                            py-0.25 text-sigil-control text-sigil-bg-dark
                          "
                        >
                          {label.text}
                        </span>
                      </TooltipWrapper>
                    ))}
                    {!name.length && (
                      <TooltipWrapper tooltip={namePlaceholder}>
                        <span
                          className="
                            grow basis-0 truncate p-0.5 italic opacity-50
                          "
                        >
                          {namePlaceholder}
                        </span>
                      </TooltipWrapper>
                    )}
                  </div>
                  {link && (
                    <div
                      className="
                        flex items-center gap-0.25
                        text-timecode-usage-foreground
                      "
                      style={cssSigilColorUsageVariables(
                        'timecode-usage',
                        // Override timecode color with the user hint preferences
                        // when no color is specified
                        // as that will be what's used by the linked input/generator
                        sigilColorUsage(link.color ?? 'hint'),
                      )}
                    >
                      <div
                        className="
                          m-0.25 flex items-center gap-0.25 rounded-md border
                          border-sigil-bg-light bg-timecode-usage-foreground
                          px-1 py-0.25 text-sigil-control
                          text-timecode-usage-text
                        "
                      >
                        <Icon icon="link" className="text-[120%]" />
                        <span>{link.type}</span>
                      </div>
                      <div
                        className={cn(
                          'w-0 grow truncate p-0.5',
                          cnd(
                            link.name.length,
                            'font-bold',
                            'italic opacity-50',
                          ),
                        )}
                      >
                        {link.name.length
                          ? link.name.join(' / ')
                          : link.namePlaceholder}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <ControlButtonGroup className="rounded-md bg-sigil-bg-light">
              {openOutputDeviceDialog && (
                <ControlButton
                  variant="toolbar"
                  icon="volume_up"
                  title={STRINGS.audio.outputSettings}
                  onClick={openOutputDeviceDialog}
                >
                  {`${Math.round(currentOutputVolume * 100)}%`}
                </ControlButton>
              )}
              {openInputDeviceDialog && (
                <ControlButton
                  variant="toolbar"
                  icon="mic"
                  title={STRINGS.audio.inputSettings}
                  onClick={openInputDeviceDialog}
                />
              )}
              {closeOrClear && (
                <ControlButton
                  variant="toolbar"
                  icon="close"
                  title={closeOrClear.tooltip}
                  onClick={closeOrClear.call}
                />
              )}
              <ControlButton
                variant="toolbar"
                icon="open_in_new"
                title={STRINGS.openInNewWindow}
                onClick={openInNewWindow}
              />
              {buttons}
            </ControlButtonGroup>
          </>
        }
      />
      {assignToOutput && id && !isOutputInstanceId(id) && (
        <SizeAwareDiv
          className="
            absolute inset-0 flex cursor-pointer items-center justify-center
            bg-timecode-backdrop text-timecode-usage-text
            hover:bg-timecode-backdrop-hover
          "
          onClick={() => assignToOutput(id)}
        >
          <Icon icon="link" className="text-block-icon" />
        </SizeAwareDiv>
      )}
    </div>
  );
};

type FullscreenTimecodeConfig = {
  config: UniversalConfig;
  type: string;
  name: string[];
  color: SigilColor | undefined;
  namePlaceholder: string;
  disabled: boolean;
};

const labelForMidiTarget = (target: MidiTargetConfig): TimecodeLabel => ({
  text:
    target.type === 'virtual'
      ? STRINGS.midi.deviceLabelForVirtual
      : STRINGS.midi.deviceLabelForPort(target.deviceName),
});

export const useTimecodeLabels = (id: TimecodeInstanceId): TimecodeLabel[] => {
  const { config } = useContext(ConfigContext);

  const iface = useMemo<string | null>(() => {
    if (isInputInstanceId(id)) {
      const c = config.inputs[id[1]];
      if (!c) {
        return null;
      }
      if (c.definition.type === 'artnet' || c.definition.type === 'tcnet') {
        return c.definition.iface;
      }
    } else if (isOutputInstanceId(id)) {
      const c = config.outputs[id[1]];
      if (!c) {
        return null;
      }
      if (
        c.definition.type === 'artnet' &&
        c.definition.target.type === 'interface'
      ) {
        return c.definition.target.interface;
      }
      return null;
    }
    return null;
  }, [id, config]);

  const ifaceInfo = useNetworkInterfaceInfo(iface);

  const extraLabels = useMemo<TimecodeLabel[]>(() => {
    if (isInputInstanceId(id)) {
      const c = config.inputs[id[1]];
      if (!c) {
        return [];
      }
      if (c.definition.type === 'midi') {
        return [labelForMidiTarget(c.definition.target)];
      }
      return [];
    } else if (isGeneratorInstanceId(id)) {
      const c = config.generators[id[1]];
      if (!c) {
        return [];
      }
      if (
        c.definition.type === 'clock' &&
        c.definition.mode === 'system' &&
        c.definition.timezone
      ) {
        return [
          {
            text: STRINGS.generators.clock.systemTimezone(
              c.definition.timezone,
            ),
          },
        ];
      }
      return [];
    } else {
      const c = config.outputs[id[1]];
      if (!c) {
        return [];
      }
      if (c.definition.type === 'midi') {
        return [labelForMidiTarget(c.definition.target)];
      }
      if (
        c.definition.type === 'artnet' &&
        c.definition.target.type === 'host'
      ) {
        return [
          {
            text: STRINGS.general.networkTargetHost(c.definition.target.host),
          },
        ];
      }
      return [];
    }
  }, [id, config]);

  return useMemo(
    () => [
      ...(ifaceInfo
        ? [
            {
              text: `${ifaceInfo.name} (${ifaceInfo.address})`,
            },
          ]
        : []),
      ...extraLabels,
    ],
    [ifaceInfo, extraLabels],
  );
};

export const FullscreenTimecodeDisplay: FC<{ id: TimecodeInstanceId }> = ({
  id,
}) => {
  const { config } = useContext(ConfigContext);
  const applicationState = useContext(ApplicationStateContext);

  const timecode: TimecodeInstance | null = useMemo(() => {
    if (isInputInstanceId(id) || isGeneratorInstanceId(id)) {
      return getTimecodeInstance(applicationState, id);
    } else {
      const c = config.outputs[id[1]];
      if (!c || !c.enabled) {
        return null;
      }
      return augmentUpstreamTimecodeWithOutputMetadata(
        c.link ? getTimecodeInstance(applicationState, c.link) : null,
        c,
      );
    }
  }, [applicationState, id, config.outputs]);

  const linkedSourceInfo = useMemo(() => {
    if (isOutputInstanceId(id)) {
      const c = config.outputs[id[1]];
      if (c?.link) {
        return getLinkedSourceInfo(c.link, config);
      }
    }
    return undefined;
  }, [id, config]);

  const audioConfig: UniversalConfigWithDefinition<GeneratorPlayerDefinition> | null =
    useMemo(() => {
      if (isGeneratorInstanceId(id)) {
        const c = config.generators[id[1]];
        if (isAudioPlayerGenerator(c)) {
          return c;
        }
      }
      return null;
    }, [id, config.generators]);

  const ltcOutputConfig = useMemo(() => {
    if (isOutputInstanceId(id)) {
      const c = config.outputs[id[1]];
      if (c?.definition.type === 'ltc') {
        return c;
      }
    }
    return null;
  }, [id, config.outputs]);

  const labels = useTimecodeLabels(id);

  const instanceConfig: FullscreenTimecodeConfig | null = useMemo(() => {
    if (isInputInstanceId(id)) {
      const c = config.inputs[id[1]];
      if (!c) {
        return null;
      }
      return {
        config: { delayMs: c.delayMs ?? null },
        type: STRINGS.protocols[c.definition.type].short,
        name: c.name ? [c.name] : [],
        color: c.color,
        namePlaceholder: STRINGS.inputs.unnamed,
        disabled: !c.enabled,
      };
    } else if (isGeneratorInstanceId(id)) {
      const c = config.generators[id[1]];
      if (!c) {
        return null;
      }
      return {
        config: { delayMs: c.delayMs ?? null },
        type: STRINGS.generators.type[c.definition.type],
        name: c.name ? [c.name] : [],
        color: c.color,
        namePlaceholder: STRINGS.generators.unnamed,
        disabled: false,
      };
    } else {
      const c = config.outputs[id[1]];
      if (!c) {
        return null;
      }
      return {
        config: { delayMs: c.delayMs ?? null },
        type: STRINGS.protocols[c.definition.type].short,
        name: c.name ? [c.name] : [],
        color: c.color,
        namePlaceholder: STRINGS.outputs.unnamed,
        disabled: !c.enabled,
      };
    }
  }, [id, config]);

  const rootState: TimecodeDisplayProps['rootState'] = useMemo(() => {
    if (isInputInstanceId(id)) {
      return {
        errors: applicationState.inputs?.[id[1]]?.errors ?? [],
        warnings: applicationState.inputs?.[id[1]]?.warnings ?? [],
      };
    } else if (isGeneratorInstanceId(id)) {
      return {
        errors: applicationState.generators?.[id[1]]?.errors ?? [],
        warnings: applicationState.generators?.[id[1]]?.warnings ?? [],
      };
    } else {
      return {
        errors: applicationState.outputs?.[id[1]]?.errors ?? [],
        warnings: applicationState.outputs?.[id[1]]?.warnings ?? [],
      };
    }
  }, [id, applicationState]);

  if (!instanceConfig) {
    return (
      <SizeAwareDiv
        className="
          flex grow flex-col items-center justify-center gap-1 bg-sigil-bg-light
          p-1 text-sigil-foreground-muted
        "
      >
        <Icon icon="question_mark" className="text-block-icon" />
        <div className="text-center">{STRINGS.errors.unknownTimecodeID}</div>
      </SizeAwareDiv>
    );
  }

  return (
    <div
      className="
        flex h-0 grow flex-col gap-px overflow-y-auto bg-sigil-border
        scrollbar-sigil
      "
    >
      {audioConfig ? (
        <AudioPlaybackContextProvider id={id}>
          <WithAudioPlayer
            uuid={id[1]}
            config={audioConfig}
            timecodeDisplay={({ loadFile, startPlayer, errors }) => (
              <TimecodeTreeDisplay
                id={id}
                timecode={instanceConfig.disabled ? 'disabled' : timecode}
                rootState={{
                  ...rootState,
                  errors: [...rootState.errors, ...errors],
                }}
                assignToOutput={null}
                buttons={null}
                labels={labels}
                link={linkedSourceInfo}
                loadFile={loadFile}
                startPlayer={startPlayer}
                {...instanceConfig}
              />
            )}
          />
        </AudioPlaybackContextProvider>
      ) : ltcOutputConfig ? (
        <AudioPlaybackContextProvider id={id} singleChannel>
          <WithLtcPlayer
            uuid={id[1]}
            config={ltcOutputConfig}
            timecode={instanceConfig.disabled ? null : timecode}
          >
            <TimecodeTreeDisplay
              id={id}
              timecode={instanceConfig.disabled ? 'disabled' : timecode}
              rootState={rootState}
              assignToOutput={null}
              buttons={null}
              labels={labels}
              link={linkedSourceInfo}
              loadFile={null}
              startPlayer={null}
              {...instanceConfig}
            />
          </WithLtcPlayer>
        </AudioPlaybackContextProvider>
      ) : (
        <TimecodeTreeDisplay
          id={id}
          timecode={instanceConfig.disabled ? 'disabled' : timecode}
          rootState={rootState}
          assignToOutput={null}
          buttons={null}
          labels={labels}
          link={linkedSourceInfo}
          loadFile={null}
          startPlayer={null}
          {...instanceConfig}
        />
      )}
    </div>
  );
};
