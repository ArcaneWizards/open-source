import { FC, ReactNode, useContext, useEffect, useState } from 'react';
import {
  isTimecodeGroup,
  isTimecodeInstance,
  InputOrGenInstance,
  TimecodeGroup,
  TimecodeInstance,
  TimecodeState,
  TimecodeTotalTime,
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
import { ControlButtonGroup } from '@arcanewizards/sigil/frontend/controls';
import { TooltipWrapper } from '@arcanewizards/sigil/frontend/tooltip';
import { STRINGS } from '../../constants';
import { AssignToOutputCallback } from '../types';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { SizeAwareDiv } from './size-aware-div';

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
};

const Timeline: FC<TimelineProps> = ({ state, totalTime }) => {
  const [millis, setMillis] = useState(0);

  const { timeDifferenceMs } = useContext(StageContext);

  useEffect(() => {
    if (state.state === 'none') {
      setMillis(0);
      return;
    }

    if (state.state === 'stopped') {
      setMillis(state.positionMillis);
      return;
    }

    let animationFrame: number | null = null;

    const updateMillis = () => {
      const newMillis =
        (Date.now() -
          (timeDifferenceMs ?? 0) -
          state.effectiveStartTimeMillis) *
        state.speed;
      setMillis(newMillis);
      animationFrame = requestAnimationFrame(updateMillis);
    };
    updateMillis();
    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [state, timeDifferenceMs]);

  return (
    <div className="w-full border border-timecode-usage-foreground p-px">
      <div className="relative h-1 w-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-timecode-usage-foreground"
          style={{
            width: `${Math.min((millis / totalTime.timeMillis) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
};

type UniversalConfig = {
  delayMs: number | null;
};

type TimecodeDisplayProps = {
  timecode: TimecodeInstance;
  config: UniversalConfig;
  headerComponents?: React.ReactNode;
};

const TimecodeDisplay: FC<TimecodeDisplayProps> = ({
  timecode: { state, metadata },
  config,
  headerComponents,
}) => {
  return (
    <div className="flex grow flex-col gap-px">
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
          <div className="flex flex-wrap gap-0.25">{headerComponents}</div>
        )}
        <SizeAwareDiv className="relative min-h-timecode-min-height grow">
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                'font-mono text-timecode-adaptive',
                cnd(state?.state === 'stopped', 'opacity-50'),
              )}
            >
              {state.state === 'none' ? (
                '--:--:--:---'
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
        {metadata?.totalTime && (
          <Timeline state={state} totalTime={metadata.totalTime} />
        )}
      </div>
      {(state.smpteMode !== null ||
        state.accuracyMillis !== null ||
        config.delayMs !== null) && (
        <div className="flex gap-px">
          {config.delayMs !== null && (
            <div className="grow basis-0 truncate bg-sigil-bg-light p-0.5">
              {STRINGS.delay(config.delayMs)}
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
    </div>
  );
};

type TimecodeTreeDisplayProps = {
  config: UniversalConfig;
  /**
   * Outputs will not have this set, inputs and generators will.
   */
  id: InputOrGenInstance | null;
  type: string;
  name: string[];
  color: SigilColor | undefined;
  timecode: TimecodeGroup | TimecodeInstance | null;
  namePlaceholder: string;
  buttons: ReactNode;
  /**
   * If set, calling this will assign the instance to the given output on
   */
  assignToOutput: AssignToOutputCallback;
};

const EMPTY_TIMECODE: TimecodeInstance = {
  name: null,
  state: {
    state: 'none',
    accuracyMillis: null,
    smpteMode: null,
    onAir: null,
  },
  metadata: null,
};

const extendId = (
  id: InputOrGenInstance | null,
  key: string,
): InputOrGenInstance | null => {
  if (!id) {
    return null;
  }
  return [id[0], ...id.slice(1), key];
};

export const TimecodeTreeDisplay: FC<TimecodeTreeDisplayProps> = ({
  config,
  id,
  type,
  name,
  color,
  timecode,
  namePlaceholder,
  buttons,
  assignToOutput,
}) => {
  name = timecode?.name ? [...name, timecode.name] : name;
  if (isTimecodeGroup(timecode) && Object.values(timecode.timecodes).length) {
    return Object.entries(timecode.timecodes).map(([key, child]) => (
      <TimecodeTreeDisplay
        config={config}
        id={extendId(id, key)}
        key={key}
        type={type}
        name={name}
        color={timecode.color ?? color}
        timecode={child}
        namePlaceholder={namePlaceholder}
        buttons={buttons}
        assignToOutput={assignToOutput}
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
        timecode={isTimecodeInstance(timecode) ? timecode : EMPTY_TIMECODE}
        config={config}
        headerComponents={
          <>
            <div className="flex grow items-start gap-0.25">
              <div
                className="
                  m-0.25 rounded-md border border-sigil-bg-light
                  bg-timecode-usage-foreground px-1 py-0.25 text-sigil-control
                  text-timecode-usage-text
                "
              >
                {type}
              </div>
              <div
                className={cn(
                  'grow basis-0 truncate p-0.5',
                  cnd(name.length, 'font-bold', 'italic opacity-50'),
                )}
              >
                {name.length ? name.join(' / ') : namePlaceholder}
              </div>
            </div>
            <ControlButtonGroup className="rounded-md bg-sigil-bg-light">
              {buttons}
            </ControlButtonGroup>
          </>
        }
      />
      {assignToOutput && id && (
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
