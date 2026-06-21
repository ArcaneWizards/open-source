import { Logger } from '@arcanejs/protocol/logging';
import { MidiTargetConfig } from '../components/proto';
import { useEffect, useMemo, useState } from 'react';
import {
  MidiEndpointInfo,
  MIDIEndpointsChangedEvent,
  MIDIEventListener,
  MIDIInterface,
} from '@arcanewizards/midi';

const STATUS_POLL_INTERVAL = 5000;

export const useMidiDeviceWatcher = (
  log: Logger,
  m: MIDIInterface | null,
  type: 'inputs' | 'outputs',
  target: MidiTargetConfig,
): 'loading' | MidiEndpointInfo | null => {
  const [availableDevices, setAvailableDevices] = useState<
    MidiEndpointInfo[] | null
  >(null);

  useEffect(() => {
    // Keep track of available devices as state so that we can react to changes
    // in device availability

    let listener: MIDIEventListener<MIDIEndpointsChangedEvent> | null = null;
    let interval: NodeJS.Timeout | null = null;

    if (!m) {
      setAvailableDevices(null);
      return;
    }

    m.getSupportInfo()
      .then((supportInfo) => {
        if (!supportInfo.supported) {
          setAvailableDevices([]);
          return;
        }

        if (supportInfo.notifications.supported) {
          listener = (e) => {
            setAvailableDevices(e.endpoints[type]);
          };
          m.addEventListener('endpointschanged', listener);
          // Get the initial list of devices
          m.getEndpoints()
            .then((endpoints) => setAvailableDevices(endpoints[type]))
            .catch((cause) => {
              const error = new Error(`Failed to get MIDI ${type}`, { cause });
              log.error(error);
            });
        } else {
          // If notifications aren't supported, poll for changes every 5 seconds
          interval = setInterval(() => {
            m.getEndpoints()
              .then((endpoints) => setAvailableDevices(endpoints[type]))
              .catch((cause) => {
                const error = new Error(`Failed to get MIDI ${type}`, {
                  cause,
                });
                log.error(error);
              });
          }, STATUS_POLL_INTERVAL);
        }
      })
      .catch((cause) => {
        const error = new Error('Failed to get MIDI support info', { cause });
        log.error(error);
        setAvailableDevices([]);
      });

    return () => {
      if (listener) {
        m.removeEventListener('endpointschanged', listener);
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [m, log, type]);

  const deviceInfo = useMemo(() => {
    if (target.type === 'virtual') {
      return null;
    }
    if (availableDevices === null) {
      return 'loading' as const;
    }
    return availableDevices.find((o) => o.name === target.deviceName) ?? null;
  }, [availableDevices, target]);

  return deviceInfo;
};
