import { startArcaneFrontend } from '@arcanejs/toolkit/frontend';
import { CORE_FRONTEND_COMPONENT_RENDERER } from '@arcanejs/toolkit-frontend';
import { FrontendComponentRenderer } from '@arcanejs/toolkit-frontend/types';
import { ReactNode } from 'react';
import { AppRoot } from './app-root';
import {
  BaseBrowserContext,
  createDefaultBrowserContext,
} from './browser-context';
import { isSigilComponent, SIGIL_NAMESPACE } from '../backend/proto';

export const createSigilFrontendRenderer = <
  TBrowserContext extends BaseBrowserContext,
>(
  browser: TBrowserContext,
): FrontendComponentRenderer => ({
  namespace: SIGIL_NAMESPACE,
  render: (info) => {
    if (!isSigilComponent(info)) {
      throw new Error(`Cannot render component ${info.namespace}`);
    }

    switch (info.component) {
      case 'app-root':
        return <AppRoot browser={browser} info={info} />;
    }
  },
});

export type StartSigilFrontendOptions<
  TBrowserContext extends BaseBrowserContext,
> = {
  browser?: Partial<TBrowserContext> | null;
  appRenderers: FrontendComponentRenderer[];
  loadingState?: () => ReactNode;
};

const defaultLoadingState = () => (
  <div style={{ width: '100%', textAlign: 'center', padding: '2rem' }}>
    Loading...
  </div>
);

export const startSigilFrontend = <TBrowserContext extends BaseBrowserContext>({
  browser,
  appRenderers,
  loadingState = defaultLoadingState,
}: StartSigilFrontendOptions<TBrowserContext>) => {
  const resolvedBrowser = createDefaultBrowserContext<TBrowserContext>(browser);

  startArcaneFrontend({
    renderers: [
      CORE_FRONTEND_COMPONENT_RENDERER,
      createSigilFrontendRenderer(resolvedBrowser),
      ...appRenderers,
    ],
    loadingState,
  });

  return resolvedBrowser;
};
