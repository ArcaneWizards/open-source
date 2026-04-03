import z from 'zod';
import { TimecodeInstanceId } from './components/proto';

export const TIMECODE_PATH_FRAGMENT = 'tc';

export const WINDOW_MODE_TIMECODE = 'timecode';

type FragmentValues = {
  tc?: TimecodeInstanceId;
};

type WithUrlFragmentArgs = {
  location?: Location | URL;
  values: FragmentValues;
};

export const withUrlFragment = ({ location, values }: WithUrlFragmentArgs) => {
  const url = new URL(location ? location.href : window.location.href);
  const fragmentParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      fragmentParams.delete(key);
    } else {
      fragmentParams.set(key, JSON.stringify(value));
    }
  }
  url.hash = `#${fragmentParams.toString()}`;
  return url;
};

export const getFragmentValue = <K extends keyof FragmentValues>(
  key: K,
  zodParser: z.ZodType<NonNullable<FragmentValues[K]>>,
): NonNullable<FragmentValues[K]> | null => {
  const url = new URL(window.location.href);
  const fragmentParams = new URLSearchParams(url.hash.slice(1));
  const value = fragmentParams.get(key);
  if (!value) {
    return null;
  }
  try {
    return zodParser.parse(JSON.parse(value));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Error parsing URL fragment value for key ${key}:`, e);
    return null;
  }
};
