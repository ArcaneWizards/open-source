import { FC } from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { Spinner } from './spinner';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { cnd } from './styling';

export type InternalUserActionState<T> =
  | {
      type: 'idle' | 'loading';
    }
  | {
      type: 'success';
      data: T;
    }
  | {
      type: 'error';
      title: string;
      details?: string;
    };

export type UserActionState<T> =
  | {
      // Idle
      idle: true;
      success: false;
      loading: false;
      error: false;
    }
  | {
      // Loading
      idle: false;
      success: false;
      loading: true;
      error: false;
    }
  | {
      // Success
      idle: false;
      success: true;
      data: T;
      loading: false;
      error: false;
    }
  | {
      // Error
      idle: false;
      success: false;
      loading: false;
      error: true;
      title: string;
      details?: string;
    };

export const prepareUserActionsState = <T,>(
  state: InternalUserActionState<T>,
  pending: boolean = false,
): UserActionState<T> => {
  if (pending || state.type === 'loading') {
    return { idle: false, success: false, loading: true, error: false };
  }
  switch (state.type) {
    case 'idle':
      return { idle: true, success: false, loading: false, error: false };
    case 'success':
      return {
        idle: false,
        success: true,
        data: state.data,
        loading: false,
        error: false,
      };
    case 'error':
      return {
        idle: false,
        success: false,
        loading: false,
        error: true,
        title: state.title,
        details: state.details,
      };
  }
};

type UserActionAlertProps = {
  action: UserActionState<unknown>;
  displaySuccess?: boolean;
  className?: string;
};

export const UserActionAlert: FC<UserActionAlertProps> = ({
  action,
  displaySuccess,
  className,
}) => {
  if (action.error) {
    return (
      <Alert variant="error" className={className}>
        <Icon icon="warning" />
        <AlertTitle>{action.title}</AlertTitle>
        {action.details && (
          <AlertDescription>{action.details}</AlertDescription>
        )}
      </Alert>
    );
  }

  if (displaySuccess && action.success && typeof action.data === 'string') {
    return (
      <Alert className={className}>
        <Icon icon="check_circle" />
        <AlertTitle>{action.data}</AlertTitle>
      </Alert>
    );
  }

  return null;
};

type LoadingWrapperProps = {
  children?: React.ReactNode;
  className?: string;
  alert?: 'none' | 'error' | 'success';
} & ({ loading: boolean } | { action: UserActionState<unknown> });

export const LoadingWrapper: FC<LoadingWrapperProps> = ({
  children,
  className,
  alert = 'error',
  ...props
}: LoadingWrapperProps) => {
  const loading = 'loading' in props ? props.loading : props.action.loading;

  return (
    <div className={cn('relative min-h-4', className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner
            className="size-4 text-sigil-usage-hint-foreground"
            variant="ring"
          />
        </div>
      )}
      <div className={cn(cnd(loading, 'opacity-0'))}>
        {alert !== 'none' && 'action' in props && (
          <UserActionAlert
            action={props.action}
            displaySuccess={alert === 'success'}
          />
        )}
        {children}
      </div>
    </div>
  );
};
