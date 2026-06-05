import { CORE_FRONTEND_COMPONENT_RENDERER } from '@arcanejs/toolkit-frontend';
import { FrontendComponentRenderer } from '@arcanejs/toolkit-frontend/types';
import { startArcaneFrontend } from '@arcanejs/toolkit/frontend';
import { isCustomComponent } from './custom-proto';
import { FC } from 'react';

import { ltc } from '../src';

const LtcDemo: FC = () => {
  return ltc();
};

const CUSTOM_FRONTEND_COMPONENT_RENDERER: FrontendComponentRenderer = {
  namespace: 'custom',
  render: (info): React.ReactElement => {
    if (!isCustomComponent(info)) {
      throw new Error(`Cannot render non-core component ${info.namespace}`);
    }
    switch (info.component) {
      case 'ltc':
        return <LtcDemo />;
    }
  },
};

startArcaneFrontend({
  renderers: [
    CORE_FRONTEND_COMPONENT_RENDERER,
    CUSTOM_FRONTEND_COMPONENT_RENDERER,
  ],
});
