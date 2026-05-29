export type SupportResponse =
  | {
      supported: true;
      virtual:
        | {
            supported: true;
          }
        | {
            supported: false;
            reason: string;
          };
    }
  | {
      supported: false;
      reason: string;
    };

export type MidiEndpointInfo = {
  name: string;
  portId: number;
};

export type MIDIOutput = {
  getInfo(): MidiEndpointInfo;
  sendMessage(message: number[]): void;
  close(): void;
};

export type MIDIInput = {
  getInfo(): MidiEndpointInfo;
  addMessageListener(listener: (message: number[]) => void): void;
  removeMessageListener(listener: (message: number[]) => void): void;
  close(): void;
};

export type VirtualPortOptions = {
  manufacturer?: string;
  model?: string;
};

export type MIDIInterface = {
  getSupportInfo(): SupportResponse;
  getInputs(): MidiEndpointInfo[];
  getOutputs(): MidiEndpointInfo[];
  openInput(endpoint: MidiEndpointInfo): MIDIInput;
  openOutput(endpoint: MidiEndpointInfo): MIDIOutput;
  createVirtualInput(name: string, options?: VirtualPortOptions): MIDIInput;
  createVirtualOutput(name: string, options?: VirtualPortOptions): MIDIOutput;
};
