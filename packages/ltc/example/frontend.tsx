/* eslint-disable no-console */
import { CORE_FRONTEND_COMPONENT_RENDERER } from '@arcanejs/toolkit-frontend';
import { FrontendComponentRenderer } from '@arcanejs/toolkit-frontend/types';
import { startArcaneFrontend } from '@arcanejs/toolkit/frontend';
import { isCustomComponent } from './custom-proto';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';

import {
  createLTCReader,
  createLTCWriter,
  SMPTETimecodePlayState,
} from '../src';

type AudioDevices = {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
};

const getAudioDevices = async (): Promise<AudioDevices> => {
  // Labels will not be visible until the user has granted permission
  const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  tempStream.getTracks().forEach((track) => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();

  const outputs = devices.filter((device) => device.kind === 'audiooutput');
  const inputs = devices.filter((device) => device.kind === 'audioinput');

  return { inputs, outputs };
};

const LtcDemo: FC = () => {
  const [audioInputs, setAudioInputs] = useState<AudioDevices | null>(null);

  const [openAudioStream, setOpenAudioStream] = useState<MediaStream | null>(
    null,
  );

  const [outputTimecodeState, setOutputTimecodeState] =
    useState<SMPTETimecodePlayState | null>(null);

  const [selectedOutputDeviceLabel, setSelectedOutputDeviceLabel] = useState<
    string | null
  >(null);

  const inputCtx = useMemo(() => new AudioContext(), []);
  const outputCtx = useMemo(() => new AudioContext(), []);

  const loadAudioDevices = useCallback(() => {
    getAudioDevices().then((audioDevices) => {
      console.log(audioDevices);
      setAudioInputs(audioDevices);
    });
  }, []);

  const openAudioInput = useCallback(async (deviceId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
    });
    setOpenAudioStream(stream);
  }, []);

  useEffect(() => {
    if (!openAudioStream) {
      return;
    }

    const sourceNode = inputCtx.createMediaStreamSource(openAudioStream);
    const reader = createLTCReader({
      ctx: inputCtx,
      channels: sourceNode.channelCount,
      handlePlayStateChange: (channel, state) => {
        if (state.state === 'playing') {
          const timestamp = Date.now() - state.effectiveStartTime;
          console.log(
            `Channel ${channel} is playing with speed ${state.speed} and SMPTE mode ${state.smpteMode} for ${timestamp} ms`,
          );
        } else {
          console.log(
            `Channel ${channel} is stopped at time ${state.currentTimeMillis} ms`,
          );
        }
      },
    });
    sourceNode.connect(reader.getInput());

    return () => {
      // Close audio stream when component unmounted or new stream opened
      openAudioStream.getTracks().forEach((track) => track.stop());
    };
  }, [openAudioStream, inputCtx]);

  useEffect(() => {
    if (!('setSinkId' in AudioContext.prototype)) {
      console.warn('Output device selection is not supported in this browser.');
      return;
    }

    const c = outputCtx as AudioContext & {
      setSinkId: (id: string | { type: 'none' }) => Promise<void>;
    };

    if (!selectedOutputDeviceLabel) {
      console.log('Setting output to none');
      c.setSinkId({ type: 'none' }).catch((err) => {
        console.error('Error setting output device:', err);
      });
      return;
    }

    // Switch output context sink to selected output device
    const matchingDevice = audioInputs?.outputs.find(
      (device) => device.label === selectedOutputDeviceLabel,
    );

    if (matchingDevice) {
      console.log('Setting output to device:', matchingDevice);
      c.setSinkId(matchingDevice.deviceId).catch((err) => {
        console.error('Error setting output device:', err);
      });
    }
  }, [selectedOutputDeviceLabel, audioInputs, outputCtx]);

  useEffect(() => {
    if (!outputTimecodeState) {
      return;
    }

    const writer = createLTCWriter({
      ctx: outputCtx,
      channels: outputCtx.destination.channelCount,
    });
    writer.getOutput().connect(outputCtx.destination);

    return () => {
      writer.close();
    };
  }, [outputTimecodeState, outputCtx]);

  return (
    <div>
      <button onClick={loadAudioDevices}>Load Audio Devices</button>
      {openAudioStream && (
        <button onClick={() => setOpenAudioStream(null)}>
          Close Audio Stream
        </button>
      )}
      {outputTimecodeState ? (
        <button onClick={() => setOutputTimecodeState(null)}>
          Stop Output Timecode
        </button>
      ) : (
        <button
          onClick={() =>
            setOutputTimecodeState({
              state: 'playing',
              effectiveStartTime: Date.now(),
              speed: 1.0,
              smpteMode: 'SMPTE',
            })
          }
        >
          Start Output Timecode
        </button>
      )}
      <ul>
        {audioInputs?.inputs.map((input) => (
          <li key={input.deviceId}>
            {input.label || 'Unknown Audio Input'}
            <button onClick={() => openAudioInput(input.deviceId)}>Open</button>
          </li>
        ))}
      </ul>
      <ul>
        {audioInputs?.outputs.map((output) => (
          <li key={output.deviceId}>
            {output.label || 'Unknown Audio Output'}
            {selectedOutputDeviceLabel === output.label ? ' (Selected)' : ''}
            <button onClick={() => setSelectedOutputDeviceLabel(output.label)}>
              Select
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CUSTOM_FRONTEND_COMPONENT_RENDERER: FrontendComponentRenderer = {
  namespace: 'custom',
  render: (info): React.ReactElement => {
    if (!isCustomComponent(info)) {
      throw new Error(`Cannot render non-core component ${info.namespace}`);
    }
    switch (info.component) {
      case 'ltc':
        return <LtcDemo />;
    }
  },
};

startArcaneFrontend({
  renderers: [
    CORE_FRONTEND_COMPONENT_RENDERER,
    CUSTOM_FRONTEND_COMPONENT_RENDERER,
  ],
});
