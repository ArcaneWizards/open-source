import {
  ComponentPropsWithoutRef,
  FC,
  createContext,
  forwardRef,
  MouseEvent,
  ReactNode,
  type ReactEventHandler,
  useEffect,
  useState,
} from 'react';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { ControlButton } from './controls';
import { cnd } from './styling';

export type DialogComponent = (close: () => void) => ReactNode;

export type DialogVariant = 'dark' | 'light' | 'light-compact' | 'dark-compact';

type DialogOptions = {
  closable?: boolean;
  title?: string | ReactNode;
  variant?: DialogVariant;
};

type DialogItem = {
  dialog: DialogComponent;
  options: DialogOptions;
};

type CreateDialog = (dialog: DialogComponent, opts?: DialogOptions) => void;
type DisplayMessage = (
  message: string | ReactNode,
  title?: string | ReactNode,
) => void;
type DisplayError = (
  message: string | ReactNode,
  title?: string | ReactNode,
) => void;

const isDarkDialog = (variant: DialogVariant) =>
  variant === 'dark' || variant === 'dark-compact';

export const DialogContext = createContext<{
  createDialog: CreateDialog;
  displayMessage: DisplayMessage;
  displayError: DisplayError;
}>({
  createDialog: () => {
    throw new Error('DialogContext not provided');
  },
  displayMessage: () => {
    throw new Error('DialogContext not provided');
  },
  displayError: () => {
    throw new Error('DialogContext not provided');
  },
});

export type DialogTitleProps = ComponentPropsWithoutRef<'div'> & {
  variant?: DialogVariant;
};

export const DialogTitle = forwardRef<HTMLDivElement, DialogTitleProps>(
  ({ className, variant = 'light', ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={cn(
        `
          flex items-center justify-center gap-0.6 border-b border-sigil-border
          p-arcane font-bold
        `,
        cnd(isDarkDialog(variant), 'bg-sigil-bg-light', 'bg-sigil-bg-dark'),
        className,
      )}
    />
  ),
);

DialogTitle.displayName = 'DialogTitle';

export const DialogButtons = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    className={cn('mt-arcane flex justify-end gap-0.6', className)}
  />
));

DialogButtons.displayName = 'DialogButtons';

export type DialogProps = DialogOptions & {
  children: ReactNode;
  dialogClosed: () => void;
};

export const Dialog: FC<DialogProps> = ({
  children,
  dialogClosed,
  closable = true,
  title,
  variant = 'light',
}) => {
  const [dialogRef, setDialogRef] = useState<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!dialogRef) return;
    dialogRef.showModal();
  }, [dialogRef]);

  const close = () => dialogRef?.close();

  const onClose: ReactEventHandler<HTMLDialogElement> = (event) => {
    if (closable) {
      dialogClosed();
      return;
    }
    event.preventDefault();
    event.currentTarget.showModal();
  };

  const onMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      close();
    }
  };

  return (
    <dialog
      ref={setDialogRef}
      onMouseDown={onMouseDown}
      onClose={onClose}
      className={cn(
        `
          max-w-[80vw] min-w-[10vw] border-none p-0 text-sigil-dialog-foreground
          outline-none backdrop-sigil-dialog
        `,
        cnd(isDarkDialog(variant), 'bg-sigil-bg-dark', 'bg-sigil-bg-light'),
      )}
    >
      <div className="border border-sigil-border">
        {title && <DialogTitle variant={variant}>{title}</DialogTitle>}
        <div
          className={cn(
            'text-sigil-foreground',
            cnd(
              variant === 'light-compact' || variant === 'dark-compact',
              'p-0',
            ),
            cnd(
              variant !== 'light-compact' && variant !== 'dark-compact',
              'p-arcane',
            ),
          )}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
};

type DialogProviderProps = {
  children: ReactNode;
};

export const DialogProvider: FC<DialogProviderProps> = ({ children }) => {
  const [dialogs, setDialogs] = useState<DialogItem[]>([]);

  const createDialog: CreateDialog = (dialog, options = {}) => {
    setDialogs((items) => [...items, { dialog, options }]);
  };

  const displayMessage: DisplayMessage = (message, title) => {
    createDialog(
      (close) => (
        <>
          <div>{message}</div>
          <DialogButtons>
            <ControlButton onClick={close} variant="large">
              OK
            </ControlButton>
          </DialogButtons>
        </>
      ),
      { title },
    );
  };

  const displayError: DisplayError = (message, title) =>
    displayMessage(
      message,
      <>
        <Icon icon="error" />
        {title || 'Error'}
      </>,
    );

  return (
    <DialogContext.Provider
      value={{ createDialog, displayMessage, displayError }}
    >
      {children}
      {dialogs.map((item, index) => {
        const deleteDialog = () => {
          setDialogs((items) => items.filter((dialog) => dialog !== item));
        };
        return (
          <Dialog key={index} dialogClosed={deleteDialog} {...item.options}>
            {item.dialog(deleteDialog)}
          </Dialog>
        );
      })}
    </DialogContext.Provider>
  );
};
