import { FC, useCallback, useContext, useEffect, useState } from 'react';
import { SystemContext } from '../context';
import { MIDISupportResponse } from '@arcanewizards/midi';
import {
  MidiTargetConfig,
  ToolboxRootGetMidiDevicesReturn,
} from '../../../proto';
import {
  ControlButton,
  ControlLabel,
  ControlMultiOptionButtonGroup,
  ControlParagraph,
  ControlSelect,
} from '@arcanewizards/sigil/frontend/controls';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { STRINGS } from '../../constants';

type MidiTargetSettingsProps = {
  type: 'input' | 'output';
  name: string | undefined;
  target: MidiTargetConfig;
  updateTarget: (
    change: (current: MidiTargetConfig) => MidiTargetConfig,
  ) => void;
};

type MIDIState = MIDISupportResponse &
  (
    | {
        supported: true;
        devices: ToolboxRootGetMidiDevicesReturn;
      }
    | {
        supported: false;
      }
  );

export const MidiTargetSettings: FC<MidiTargetSettingsProps> = ({
  type,
  name,
  target,
  updateTarget,
}) => {
  const { getMidiSupportInfo, getMidiDevices } = useContext(SystemContext);
  const [midiDevices, setMidiDevices] = useState<MIDIState | null>(null);

  const refreshDevices = useCallback(() => {
    setMidiDevices(null);
    getMidiSupportInfo().then((info) => {
      if (!info.supported) {
        setMidiDevices(info);
        return;
      }
      getMidiDevices().then((devices) => {
        setMidiDevices({
          ...info,
          devices,
        });
      });
    });
  }, [getMidiSupportInfo, getMidiDevices]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  if (midiDevices === null) {
    return null;
  }

  if (!midiDevices.supported) {
    return (
      <>
        <ControlParagraph mode="error" position="row">
          {`MIDI is not supported on this device: ${midiDevices.reason}`}
        </ControlParagraph>
      </>
    );
  }

  const devices = midiDevices.devices[type === 'input' ? 'inputs' : 'outputs'];

  return (
    <>
      <ControlLabel>Device Type</ControlLabel>
      <ControlMultiOptionButtonGroup
        strings={{ port: 'Port', virtual: 'Virtual' }}
        value={target.type}
        onChange={(type) =>
          updateTarget((current) =>
            current.type === type
              ? current
              : {
                  type,
                  deviceName: '',
                },
          )
        }
        position="both"
        variant="standard"
      />
      {target.type === 'port' ? (
        <>
          <ControlLabel>Device</ControlLabel>
          <ControlButton
            onClick={refreshDevices}
            title="Refresh Devices"
            position="first"
            variant="standard"
            icon="refresh"
          />
          {devices.length === 0 ? (
            <ControlParagraph mode="warning" position="row">
              No MIDI {type} devices found. Please connect a MIDI device and
              refresh the list.
            </ControlParagraph>
          ) : (
            <ControlSelect
              value={target.deviceName}
              options={
                devices.map((device) => ({
                  value: device.name,
                  label: device.name,
                })) || []
              }
              variant="standard"
              position="second"
              placeholder="Select Device"
              onChange={(deviceName) =>
                updateTarget(() => ({
                  type: 'port',
                  deviceName,
                }))
              }
            />
          )}
        </>
      ) : midiDevices.virtual.supported ? (
        name ? (
          <ControlParagraph position="row">
            {`The virtual MIDI device will have the name ${name}`}
          </ControlParagraph>
        ) : (
          <ControlParagraph mode="warning" position="row">
            {`Please specify a name for your virtual MIDI device`}
          </ControlParagraph>
        )
      ) : (
        <ControlParagraph mode="error" position="row">
          {`Virtual MIDI devices are not supported on this machine: ${midiDevices.virtual.reason}`}
        </ControlParagraph>
      )}
    </>
  );
};
