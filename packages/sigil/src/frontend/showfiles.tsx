import { cn } from '@arcanejs/toolkit-frontend/util';
import { ComponentProps, FC, useCallback, useState } from 'react';
import {
  clsControlPosition,
  ControlButton,
  ControlButtonGroup,
  ControlDialog,
  ControlDialogButtons,
  ControlFileButton,
  ControlInput,
  ControlLabel,
  ControlParagraph,
  ControlPosition,
} from './controls';
import { cnd } from './styling';
import { TooltipBoundary, TooltipWrapper } from './tooltip';
import {
  ActionResponse,
  LoadingWrapper,
  success,
  useUserAction,
} from './user-actions';

const ShowFileUuidBrand = Symbol('ShowFileUuid');

export type ShowFileUuidBrand = typeof ShowFileUuidBrand;

export type ShowFileUuid = string & {
  _brand: ShowFileUuidBrand;
};

export const asShowFileUuid = (uuid: string): ShowFileUuid => {
  return uuid as ShowFileUuid;
};

export type ShowFileConfigData = {
  status:
    | {
        type: 'no-show-file';
      }
    | {
        type: 'show-file-loaded';
        hasChanges: boolean;
        uuid: ShowFileUuid;
      };
  /**
   * Map from showfile names to their filename UUIDs
   */
  showfiles: Record<string, ShowFileUuid>;
  /**
   * An error message to display if present
   */
  error?: string;
};

export type ShowFileConfigStrings = {
  unsavedChanges: string;
  changesSaved: string;
  save: string;
  saveAs: string;
  load: string;
  delete: string;
  rename: string;
  import: string;
  export: string;
  searchPlaceholder: string;
  noShowFiles: string;
  inUse: string;
  dialogs: {
    cancel: string;
    nameLabel: string;
    namePlaceholder: string;
    emptyNameError: string;
    saveAs: {
      description: string;
      save: string;
    };
    saveAsOverwriteConfirmation: {
      title: string;
      description: string;
      overwrite: string;
    };
    loadUnsavedChangesConfirmation: {
      title: string;
      description: string;
      load: string;
    };
    deleteConfirmation: {
      title: string;
      description: string;
      delete: string;
    };
    rename: {
      title: string;
      description: string;
    };
  };
};

export type ShowFileConfigProps = {
  mimeType: {
    extension: string;
    mimeType: string;
  };
  data: ShowFileConfigData;
  description?: string;
  strings: ShowFileConfigStrings;
  position?: ControlPosition;
  onSave: () => ActionResponse<string | null>;
  onSaveAs: (name: string) => ActionResponse<string | null>;
  onLoad: (uuid: ShowFileUuid) => ActionResponse<string | null>;
  /**
   * Return the file content that should be exported for the given showfile.
   */
  onExport: (uuid: ShowFileUuid) => Promise<Blob>;
  onDelete: (uuid: ShowFileUuid) => ActionResponse<string | null>;
  onRename: (
    uuid: ShowFileUuid,
    newName: string,
  ) => ActionResponse<string | null>;
  onImport: (file: FileList) => ActionResponse<string | null>;
};

const Scroll: FC<ComponentProps<typeof TooltipBoundary>> = ({
  className,
  ...props
}) => (
  <TooltipBoundary
    {...props}
    className={cn('flex flex-col overflow-y-auto scrollbar-sigil', className)}
  />
);

type DialogMode =
  | {
      mode: 'save-as';
      name: string;
      error?: string;
    }
  | {
      mode: 'save-as-overwrite-confirmation';
      name: string;
    }
  | {
      mode: 'load-unsaved-changes-confirmation';
      uuid: ShowFileUuid;
    }
  | {
      mode: 'delete-confirmation';
      uuid: ShowFileUuid;
    }
  | {
      mode: 'rename';
      uuid: ShowFileUuid;
      name: string;
      error?: string;
    }
  | null;

const getDialogTitle = (
  mode: DialogMode,
  strings: ShowFileConfigStrings,
): string => {
  switch (mode?.mode) {
    case 'save-as':
      return strings.saveAs;
    case 'save-as-overwrite-confirmation':
      return strings.dialogs.saveAsOverwriteConfirmation.title;
    case 'load-unsaved-changes-confirmation':
      return strings.dialogs.loadUnsavedChangesConfirmation.title;
    case 'delete-confirmation':
      return strings.dialogs.deleteConfirmation.title;
    case 'rename':
      return strings.dialogs.rename.title;
    default:
      return '';
  }
};

export const ShowFileConfig: FC<ShowFileConfigProps> = ({
  mimeType,
  data,
  description,
  strings,
  position,
  onSave,
  onSaveAs,
  onExport,
  onImport,
  onLoad,
  onDelete,
  onRename,
}) => {
  const unsavedChanges =
    data.status.type === 'no-show-file' || data.status.hasChanges;
  const canSaveCurrentFile =
    data.status.type === 'show-file-loaded' && data.status.hasChanges;

  /** When set, it will be a success message to display to the user */
  const [userAction, performAction] = useUserAction<string | null>();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  const onSaveButtonClicked = useCallback(() => {
    performAction(() => onSave());
  }, [onSave, performAction]);

  const onSaveAsButtonClicked = useCallback(() => {
    setDialogMode({ mode: 'save-as', name: '' });
  }, []);

  const onExportButtonClicked = useCallback(
    (name: string, uuid: ShowFileUuid) => {
      performAction(() =>
        onExport(uuid).then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${name}.${mimeType.extension}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return success(null);
        }),
      );
    },
    [performAction, onExport, mimeType.extension],
  );

  const dialogClosed = useCallback(() => {
    setDialogMode(null);
  }, []);

  const onSaveAsName = useCallback(
    (name: string) => {
      if (name.trim() === '') {
        setDialogMode({
          mode: 'save-as',
          name: '',
          error: strings.dialogs.emptyNameError,
        });
        return;
      }
      const existingName = Object.keys(data.showfiles).includes(name);
      if (existingName) {
        setDialogMode({ mode: 'save-as-overwrite-confirmation', name });
      } else {
        performAction(() => onSaveAs(name));
        setDialogMode(null);
      }
    },
    [data.showfiles, onSaveAs, performAction, strings],
  );

  const onSaveAsSubmit = useCallback(() => {
    if (dialogMode?.mode !== 'save-as') return;
    onSaveAsName(dialogMode.name);
  }, [dialogMode, onSaveAsName]);

  const onSaveAsInputChanged = useCallback(
    (name: string, enterPressed: boolean) => {
      setDialogMode((current) => {
        if (!current || current.mode !== 'save-as') return current;
        return { ...current, name };
      });
      if (enterPressed) {
        onSaveAsName(name);
      }
    },
    [onSaveAsName],
  );

  const onRenameWithName = useCallback(
    (uuid: ShowFileUuid, name: string) => {
      if (name.trim() === '') {
        setDialogMode({
          mode: 'rename',
          uuid,
          name: '',
          error: strings.dialogs.emptyNameError,
        });
        return;
      }
      performAction(() => onRename(uuid, name));
      setDialogMode(null);
    },
    [onRename, performAction, strings],
  );

  const onRenameSubmit = useCallback(() => {
    if (dialogMode?.mode !== 'rename') return;
    onRenameWithName(dialogMode.uuid, dialogMode.name);
  }, [dialogMode, onRenameWithName]);

  const onRenameInputChanged = useCallback(
    (name: string, enterPressed: boolean) => {
      setDialogMode((current) => {
        if (!current || current.mode !== 'rename') return current;
        return { ...current, name };
      });
      if (enterPressed && dialogMode?.mode === 'rename') {
        onRenameWithName(dialogMode.uuid, name);
      }
    },
    [dialogMode, onRenameWithName],
  );

  const onImportFilesSelected = useCallback(
    (files: FileList) =>
      performAction(() => onImport(files).then(() => success(null))),
    [onImport, performAction],
  );

  const onLoadButtonClicked = useCallback(
    (uuid: ShowFileUuid) => {
      if (unsavedChanges) {
        setDialogMode({ mode: 'load-unsaved-changes-confirmation', uuid });
      } else {
        performAction(() => onLoad(uuid));
      }
    },
    [unsavedChanges, onLoad, performAction],
  );

  return (
    <LoadingWrapper
      action={userAction}
      className={cn('flex flex-col gap-0.5', clsControlPosition(position))}
    >
      {dialogMode && (
        <ControlDialog
          dialogClosed={dialogClosed}
          title={getDialogTitle(dialogMode, strings)}
        >
          <>
            {dialogMode.mode === 'save-as' && (
              <>
                <ControlParagraph position="row">
                  {strings.dialogs.saveAs.description}
                </ControlParagraph>
                <ControlLabel>{strings.dialogs.nameLabel}</ControlLabel>
                <ControlInput
                  value={dialogMode.name}
                  onChange={onSaveAsInputChanged}
                  placeholder={strings.dialogs.namePlaceholder}
                  position="all"
                />
                {dialogMode.error && (
                  <ControlParagraph position="row" mode="warning">
                    {dialogMode.error}
                  </ControlParagraph>
                )}
                <ControlDialogButtons>
                  <ControlButton onClick={dialogClosed} variant="large">
                    {strings.dialogs.cancel}
                  </ControlButton>
                  <ControlButton onClick={onSaveAsSubmit} variant="large">
                    {strings.dialogs.saveAs.save}
                  </ControlButton>
                </ControlDialogButtons>
              </>
            )}
            {dialogMode.mode === 'save-as-overwrite-confirmation' && (
              <>
                <ControlParagraph position="row">
                  {strings.dialogs.saveAsOverwriteConfirmation.description}
                </ControlParagraph>
                <ControlDialogButtons>
                  <ControlButton onClick={dialogClosed} variant="large">
                    {strings.dialogs.cancel}
                  </ControlButton>
                  <ControlButton
                    onClick={() => {
                      performAction(() => onSaveAs(dialogMode.name));
                      setDialogMode(null);
                    }}
                    variant="large"
                    destructive
                  >
                    {strings.dialogs.saveAsOverwriteConfirmation.overwrite}
                  </ControlButton>
                </ControlDialogButtons>
              </>
            )}
            {dialogMode.mode === 'load-unsaved-changes-confirmation' && (
              <>
                <ControlParagraph position="row">
                  {strings.dialogs.loadUnsavedChangesConfirmation.description}
                </ControlParagraph>
                <ControlDialogButtons>
                  <ControlButton onClick={dialogClosed} variant="large">
                    {strings.dialogs.cancel}
                  </ControlButton>
                  <ControlButton
                    onClick={() => {
                      performAction(() => onLoad(dialogMode.uuid));
                      setDialogMode(null);
                    }}
                    variant="large"
                  >
                    {strings.dialogs.loadUnsavedChangesConfirmation.load}
                  </ControlButton>
                </ControlDialogButtons>
              </>
            )}
            {dialogMode.mode === 'delete-confirmation' && (
              <>
                <ControlParagraph position="row">
                  {strings.dialogs.deleteConfirmation.description}
                </ControlParagraph>
                <ControlDialogButtons>
                  <ControlButton onClick={dialogClosed} variant="large">
                    {strings.dialogs.cancel}
                  </ControlButton>
                  <ControlButton
                    onClick={() => {
                      performAction(() => onDelete(dialogMode.uuid));
                      setDialogMode(null);
                    }}
                    variant="large"
                    destructive
                  >
                    {strings.dialogs.deleteConfirmation.delete}
                  </ControlButton>
                </ControlDialogButtons>
              </>
            )}
            {dialogMode.mode === 'rename' && (
              <>
                <ControlParagraph position="row">
                  {strings.dialogs.rename.description}
                </ControlParagraph>
                <ControlLabel>{strings.dialogs.nameLabel}</ControlLabel>
                <ControlInput
                  value={dialogMode.name}
                  onChange={onRenameInputChanged}
                  placeholder={strings.dialogs.namePlaceholder}
                  position="all"
                />
                {dialogMode.error && (
                  <ControlParagraph position="row" mode="warning">
                    {dialogMode.error}
                  </ControlParagraph>
                )}
                <ControlDialogButtons>
                  <ControlButton onClick={dialogClosed} variant="large">
                    {strings.dialogs.cancel}
                  </ControlButton>
                  <ControlButton onClick={onRenameSubmit} variant="large">
                    {strings.rename}
                  </ControlButton>
                </ControlDialogButtons>
              </>
            )}
          </>
        </ControlDialog>
      )}
      {description && (
        <div className="px-0.3 py-0.6 text-sigil-foreground-muted">
          {description}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-sigil-control-gap">
        <ControlButton
          onClick={onSaveAsButtonClicked}
          variant="large"
          icon="save_as"
        >
          {strings.saveAs}
        </ControlButton>
        <ControlButton
          onClick={onSaveButtonClicked}
          variant="large"
          icon="save"
          disabled={!canSaveCurrentFile}
        >
          {strings.save}
        </ControlButton>
        <span
          className={cn(
            'px-0.3',
            cnd(
              unsavedChanges,
              `text-sigil-warning-foreground`,
              `text-sigil-success-foreground`,
            ),
          )}
        >
          {unsavedChanges ? strings.unsavedChanges : strings.changesSaved}
        </span>
        <div className="grow" />
        <ControlFileButton
          variant="large"
          icon="file_open"
          accept={`.${mimeType.extension}, ${mimeType.mimeType}`}
          multiple
          onFilesSelected={onImportFilesSelected}
        >
          {strings.import}
        </ControlFileButton>
      </div>
      {/* eslint-disable-next-line better-tailwindcss/enforce-consistent-line-wrapping */}
      <Scroll className="max-h-[200px] border border-sigil-border bg-sigil-border">
        {Object.keys(data.showfiles).length === 0 && (
          <div
            className="
              w-full bg-sigil-bg-dark p-1 text-center
              text-sigil-foreground-muted italic
            "
          >
            {strings.noShowFiles}
          </div>
        )}
        <div className="sigil-grid-table-basic w-full">
          {Object.entries(data.showfiles)
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
            .map(([name, uuid]) => (
              <div key={name} className="group sigil-grid-table-basic-subgrid">
                <TooltipWrapper tooltip={strings.load}>
                  <button
                    onClick={() => onLoadButtonClicked(uuid)}
                    className={cn(
                      `
                        sigil-grid-pos-name flex cursor-pointer items-center
                        gap-1 border-none bg-sigil-bg-dark p-1 text-[0.7rem]
                        text-sigil-foreground
                        group-hover:bg-sigil-bg-light
                        hover:bg-sigil-control-button-bg-hover
                        hover:text-sigil-control-button-fg-hover
                      `,
                      cnd(
                        data.status.type === 'show-file-loaded' &&
                          data.status.uuid === uuid,
                        `
                          text-sigil-usage-hint-foreground
                          hover:text-sigil-usage-hint-foreground
                        `,
                      ),
                    )}
                  >
                    <span>{name}</span>
                    <span className="grow" />
                    {data.status.type === 'show-file-loaded' &&
                      data.status.uuid === uuid && (
                        <span
                          className={cn(`
                            rounded-arcane-btn border
                            border-sigil-usage-hint-border
                            bg-sigil-usage-hint-background px-0.3 py-0.5
                            text-[0.7rem] text-sigil-usage-hint-text
                          `)}
                        >
                          {strings.inUse}
                        </span>
                      )}
                  </button>
                </TooltipWrapper>
                <ControlButtonGroup
                  className="
                    sigil-grid-pos-controls bg-sigil-bg-dark
                    group-hover:bg-sigil-bg-light
                  "
                >
                  <ControlButton
                    onClick={() =>
                      setDialogMode({ mode: 'delete-confirmation', uuid })
                    }
                    variant="large"
                    icon="delete"
                    title={strings.delete}
                  />
                  <ControlButton
                    onClick={() =>
                      setDialogMode({ mode: 'rename', uuid, name })
                    }
                    variant="large"
                    icon="edit"
                    title={strings.rename}
                  />
                  <ControlButton
                    onClick={() => onExportButtonClicked(name, uuid)}
                    variant="table-row"
                    icon="publish"
                    title={strings.export}
                  />
                </ControlButtonGroup>
              </div>
            ))}
        </div>
      </Scroll>
      {data.error && (
        <div className="px-0.3 py-0.6 text-sigil-error-foreground">
          {data.error}
        </div>
      )}
      {userAction.success && userAction.data && (
        <div className="px-0.3 py-0.6 text-sigil-success-foreground">
          {userAction.data}
        </div>
      )}
    </LoadingWrapper>
  );
};

ShowFileConfig.displayName = 'ShowFileConfig';
