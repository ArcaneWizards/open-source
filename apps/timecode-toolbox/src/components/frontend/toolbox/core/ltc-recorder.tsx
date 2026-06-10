import { useContext, useEffect } from 'react';
import { InputConfig } from '../../../proto';
import { AudioRecordingContext } from './audio-context';

type WithLtcRecorderProps = {
  uuid: string;
  config: InputConfig;
  children: React.ReactNode;
};

export const WithLtcRecorder: React.FC<WithLtcRecorderProps> = ({
  children,
}) => {
  const { setRecordInput, ctx } = useContext(AudioRecordingContext);

  const { ctx: context, masterGain } = ctx();

  useEffect(() => {
    setRecordInput(true);

    // Analyse and print out the volume periodically
    let lastValue = 0;
    const analyser = context.createAnalyser();
    masterGain.connect(analyser);
    const interval = setInterval(() => {
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      const value = data.reduce((sum, v) => sum + Math.abs(v - 128), 0);
      if (Math.abs(value - lastValue) > 10) {
        lastValue = value;
        // eslint-disable-next-line no-console
        console.log('Input volume:', value);
      }
    }, 100);

    return () => {
      setRecordInput(false);
      clearInterval(interval);
    };
  }, [context, masterGain, setRecordInput]);

  return children;
};
