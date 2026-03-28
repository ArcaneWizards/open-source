import { cssVariables } from '@arcanewizards/sigil/frontend/styling';
import React, { useEffect, useState } from 'react';

type SizeAwareDivProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * A div component that sets CSS variables of it's current size,
 * allowing children to use those variables to adapt to the size of the div.
 * The variables set are --size-aware-div-width and --size-aware-div-height.
 */
export const SizeAwareDiv: React.FC<SizeAwareDivProps> = ({
  children,
  style,
  ...rest
}) => {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DOMRectReadOnly | null>(null);

  useEffect(() => {
    // Detect changes in div size
    if (!div) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setRect(entry.contentRect);
      }
    });
    resizeObserver.observe(div);
    return () => {
      resizeObserver.disconnect();
    };
  }, [div]);

  return (
    <div
      ref={setDiv}
      {...rest}
      style={{
        ...style,
        ...(rect &&
          cssVariables({
            '--size-aware-div-width': rect.width + 'px',
            '--size-aware-div-height': rect.height + 'px',
          })),
      }}
    >
      {children}
    </div>
  );
};
