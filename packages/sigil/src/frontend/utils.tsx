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
      className="
        cursor-pointer text-sigil-usage-hint-foreground
        hover:underline
      "
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
          <p className="m-0 p-0">
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
          <ol className="m-0 flex list-decimal flex-col gap-2 py-0 pl-2">
            {content.children.map((child, index) => (
              <li key={index}>{apiContentToReact(child)}</li>
            ))}
          </ol>
        );
      } else {
        return (
          <ul
            className={cn(
              'm-0 flex flex-col gap-2 py-0 pl-2',
              cnd(content.listType === 'unstyled', 'list-none', 'list-disc'),
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
        <code
          className="
            rounded-sigil-control border border-sigil-border bg-sigil-bg-light
            px-1 py-0.5 text-sigil-usage-hint-foreground
          "
        >
          {content.text}
        </code>
      );
    case 'header':
      switch (content.level) {
        case 1:
          return (
            <h1 className="m-0 p-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h1>
          );
        case 2:
          return (
            <h2 className="m-0 pt-2 pb-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h2>
          );
        case 3:
          return (
            <h3 className="m-0 pt-1.5 pb-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h3>
          );
        case 4:
          return (
            <h4 className="m-0 pt-1 pb-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h4>
          );
        case 5:
          return (
            <h5 className="m-0 pt-0.5 pb-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h5>
          );
        case 6:
          return (
            <h6 className="m-0 p-0">
              {content.children.map((child, index) => (
                <Fragment key={index}>{apiContentToReact(child)}</Fragment>
              ))}
            </h6>
          );
        default:
          return (
            <p className="m-0 p-0">
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
