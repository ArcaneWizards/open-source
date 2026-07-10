import { ApiContent } from '@arcanewizards/apis';
import { FC, Fragment, useCallback } from 'react';
import { useBrowserContext } from './browser-context';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { cnd } from './styling';

const Link: FC<{ href: string; text: string }> = ({ href, text }) => {
  const { openExternalLink } = useBrowserContext();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      e.preventDefault();
      if (href) {
        openExternalLink(href);
      }
    },
    [href, openExternalLink],
  );

  return (
    <a
      onClick={handleClick}
      className="text-sigil-usage-hint-foreground cursor-pointer hover:underline"
    >
      {text}
    </a>
  );
};

export const apiContentToReact = (content: ApiContent): React.ReactNode => {
  switch (content.type) {
    case 'container':
      if (content.mode === 'inline') {
        return (
          <span>
            {content.children.map((child, index) => (
              <Fragment key={index}>{apiContentToReact(child)}</Fragment>
            ))}
          </span>
        );
      } else if (content.mode === 'paragraph') {
        return (
          <p className="p-0 m-0">
            {content.children.map((child, index) => (
              <Fragment key={index}>{apiContentToReact(child)}</Fragment>
            ))}
          </p>
        );
      } else {
        return (
          <div className="flex flex-col gap-2">
            {content.children.map((child, index) => (
              <Fragment key={index}>{apiContentToReact(child)}</Fragment>
            ))}
          </div>
        );
      }
    case 'list':
      if (content.listType === 'ordered') {
        return (
          <ol className="flex flex-col gap-2 list-decimal m-0 py-0 pl-2">
            {content.children.map((child, index) => (
              <li key={index}>{apiContentToReact(child)}</li>
            ))}
          </ol>
        );
      } else {
        return (
          <ul
            className={cn(
              'flex flex-col gap-2 m-0 py-0',
              cnd(
                content.listType === 'unstyled',
                'list-none pl-0',
                'list-disc pl-2',
              ),
            )}
          >
            {content.children.map((child, index) => (
              <li key={index}>{apiContentToReact(child)}</li>
            ))}
          </ul>
        );
      }
    case 'text':
      return <span>{content.text}</span>;
    case 'inlineCode':
      return (
        <code className="bg-sigil-bg-light px-1 py-0.5 rounded-sigil-control border border-sigil-border text-sigil-usage-hint-foreground">
          {content.text}
        </code>
      );
    case 'header':
      switch (content.level) {
        case 1:
          return (
            <h1 className="p-0 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h1>
          );
        case 2:
          return (
            <h2 className="pb-0 pt-2 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h2>
          );
        case 3:
          return (
            <h3 className="pb-0 pt-1.5 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h3>
          );
        case 4:
          return (
            <h4 className="pb-0 pt-1 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h4>
          );
        case 5:
          return (
            <h5 className="pb-0 pt-0.5 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h5>
          );
        case 6:
          return (
            <h6 className="p-0 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h6>
          );
        default:
          return (
            <p className="p-0 m-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </p>
          );
      }
    case 'link':
      return <Link href={content.url} text={content.text} />;
    default:
      return null;
  }
};
