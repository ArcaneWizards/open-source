import { FrontendComponentRenderer } from '@arcanejs/toolkit-frontend/types';
import {
  BaseBrowserContext,
  startSigilFrontend,
} from '@arcanewizards/sigil/frontend';
import { isTimecodeToolboxComponent, NAMESPACE } from '../proto';
import { ToolboxRoot } from './toolbox/root';
import { LicenseGate } from './toolbox/license';

export type TimecodeToolboxBrowserContext = BaseBrowserContext;

export const timecodeToolboxFrontendComponents =
  (): FrontendComponentRenderer => ({
    namespace: NAMESPACE,
    render: (info) => {
      if (!isTimecodeToolboxComponent(info)) {
        throw new Error(`Cannot render component ${info.namespace}`);
      }

      switch (info.component) {
        case 'toolbox-root':
          return <ToolboxRoot info={info} />;
        case 'license-gate':
          return <LicenseGate info={info} />;
      }
    },
  });

export const startTimecodeToolboxServerFrontend = (
  browser?: TimecodeToolboxBrowserContext | null,
) => {
  startSigilFrontend<TimecodeToolboxBrowserContext>({
    browser,
    appRenderers: [timecodeToolboxFrontendComponents()],
    loadingState: () => (
      <div style={{ width: '100%', textAlign: 'center', padding: '2rem' }}>
        Loading Toolbox...
      </div>
    ),
  });
};

declare global {
  interface Window {
    startTimecodeToolboxServerFrontend?: typeof startTimecodeToolboxServerFrontend;
  }
}

window.startTimecodeToolboxServerFrontend = startTimecodeToolboxServerFrontend;
