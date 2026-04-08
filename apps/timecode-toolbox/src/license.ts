import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { useEffect, useState } from 'react';

export type License = {
  text: string;
  hash: string;
};

/**
 * The module where this is defined should remain in
 */
export const getLicense = async (): Promise<License> => {
  const licenseText = await readFile(require.resolve('../LICENSE'), 'utf-8');
  const hash = createHash('sha256').update(licenseText).digest('hex');
  return { text: licenseText, hash };
};

export const useLicense = (): License | null => {
  const [license, setLicense] = useState<License | null>(null);

  useEffect(() => {
    getLicense().then(setLicense);
  }, []);

  return license;
};
