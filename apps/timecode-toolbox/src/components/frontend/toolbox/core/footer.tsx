import { ToolbarDivider } from '@arcanewizards/sigil/frontend/toolbars';
import { ExternalLink, TextButton } from '../content';
import { FC } from 'react';
import { SOURCE_CODE_URL, STRINGS } from '../../constants';

type FooterProps = {
  openLicenseDetails?: () => void;
};

export const Footer: FC<FooterProps> = ({ openLicenseDetails }) => {
  return (
    <div
      className="
        flex items-center justify-center gap-1 border-t border-sigil-border
        bg-sigil-bg-dark p-1 text-[80%]
      "
    >
      <span>
        {'Created by'}&nbsp;
        <ExternalLink href="https://arcanewizards.com">
          Arcane Wizards
        </ExternalLink>
      </span>
      <ToolbarDivider />
      <ExternalLink href={SOURCE_CODE_URL}>{STRINGS.sourceCode}</ExternalLink>
      {openLicenseDetails && (
        <>
          <ToolbarDivider />
          <TextButton onClick={openLicenseDetails}>
            {STRINGS.license}
          </TextButton>
        </>
      )}
    </div>
  );
};
