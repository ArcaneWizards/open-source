import { FC, useCallback, useMemo, useState, useTransition } from 'react';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { Spinner } from './spinner';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { cnd } from './styling';

export type ActionResponse<T> = Promise<
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      title: string;
      details?: string;
    }
>;

export const success = <T,>(data: T): Awaited<ActionResponse<T>> => {
  return { success: true, data };
};

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

export const mapUserActionState = <T, U>(
  state: UserActionState<T>,
  transform: (data: T) => U,
): UserActionState<U> => {
  if (state.success) {
    return {
      idle: false,
      success: true,
      data: transform(state.data),
      loading: false,
      error: false,
    };
  }
  return state as UserActionState<U>;
};

export const useUserAction = <T,>(initial?: T) => {
  const [state, setState] = useState<InternalUserActionState<T>>(
    initial ? { type: 'success', data: initial } : { type: 'idle' },
  );

  const [isPending, startTransition] = useTransition();

  const performAction = useCallback(
    async (action: () => ActionResponse<T>) =>
      startTransition(async () => {
        try {
          const result = await action();
          if (!result.success) {
            setState({
              type: 'error',
              title: result.title,
              details: result.details,
            });
            return;
          }
          setState({ type: 'success', data: result.data });
        } catch (error) {
          setState({
            type: 'error',
            title: 'An unexpected error ocurred',
            details: `${error}`,
          });
        }
      }),
    [],
  );

  const reset = useCallback(() => {
    setState({ type: 'idle' });
  }, []);

  const returnState = useMemo(
    () => prepareUserActionsState(state, isPending),
    [state, isPending],
  );

  return [returnState, performAction, reset] as const;
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
