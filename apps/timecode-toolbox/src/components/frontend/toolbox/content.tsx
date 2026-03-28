import { useBrowserContext } from '@arcanewizards/sigil/frontend';
import { FC } from 'react';
import { SizeAwareDiv } from './core/size-aware-div';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';

export const ExternalLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  const { openExternalLink } = useBrowserContext();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        openExternalLink(href);
      }}
      className="
        text-sigil-usage-hint-foreground no-underline
        hover:underline
      "
    >
      {children}
    </a>
  );
};

export const NoToolboxChildren: FC<{ text: string }> = ({ text }) => {
  return (
    <SizeAwareDiv
      className="
        flex grow flex-col items-center justify-center gap-1 bg-sigil-bg-light
        p-1 text-sigil-foreground-muted
      "
    >
      <Icon icon="handyman" className="text-block-icon" />
      <div className="text-center">{text}</div>
    </SizeAwareDiv>
  );
};
