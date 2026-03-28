import { useMemo, useState } from 'react';

export type KeyboardBinding = {
  key: string;
  modifiers?: {
    ctrlOrMetaKey?: boolean;
    shiftKey?: boolean;
  };
};

export type RegisteredBinding = [KeyboardBinding, ...KeyboardBinding[]];

export type PressableOnClickListener = (
  event: React.MouseEvent<unknown> | React.TouchEvent<unknown>,
) => unknown;

export const usePressable = (
  click: PressableOnClickListener,
): {
  touching: boolean;
  handlers: {
    onClick: React.MouseEventHandler<unknown>;
    onTouchStart: React.TouchEventHandler<unknown>;
    onTouchMove: React.TouchEventHandler<unknown>;
    onTouchEnd: React.TouchEventHandler<unknown>;
  };
} => {
  const [touching, setTouching] = useState(false);

  return {
    touching,
    handlers: {
      onClick: click,
      onTouchStart: () => {
        setTouching(true);
      },
      onTouchMove: () => {
        setTouching(false);
      },
      onTouchEnd: (event) => {
        if (touching) {
          // Prevent the follow-up click event from firing a second action.
          event.preventDefault();
          setTouching(false);
          click(event);
        }
      },
    },
  };
};

export const useLongPressable = ({
  onPress,
  onRelease,
}: {
  onPress: () => unknown;
  onRelease: () => unknown;
}): {
  touching: boolean;
  handlers: {
    onMouseDown: React.MouseEventHandler<unknown>;
    onMouseUp: React.MouseEventHandler<unknown>;
    onTouchStart: React.TouchEventHandler<unknown>;
    onTouchMove: React.TouchEventHandler<unknown>;
    onTouchEnd: React.TouchEventHandler<unknown>;
  };
} => {
  const [touching, setTouching] = useState(false);

  return useMemo(
    () => ({
      touching,
      handlers: {
        onTouchStart: () => {
          setTouching(true);
          onPress();
        },
        onMouseDown: () => {
          setTouching(true);
          onPress();
        },
        onMouseUp: () => {
          setTouching(false);
          onRelease();
        },
        onTouchMove: () => {
          setTouching(false);
          onRelease();
        },
        onTouchEnd: (event) => {
          if (touching) {
            // Prevent the follow-up click event from firing a second action.
            event.preventDefault();
            setTouching(false);
            onRelease();
          }
        },
      },
    }),
    [touching, onRelease, onPress],
  );
};
