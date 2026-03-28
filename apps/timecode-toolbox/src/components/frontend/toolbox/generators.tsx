import { FC } from 'react';
import { STRINGS } from '../constants';
import { PrimaryToolboxSection } from './util';
import { NoToolboxChildren } from './content';

export const GeneratorsSection: FC = () => {
  return (
    <PrimaryToolboxSection title={STRINGS.generators.title} buttons={<></>}>
      <NoToolboxChildren text={STRINGS.generators.noChildren} />
    </PrimaryToolboxSection>
  );
};
