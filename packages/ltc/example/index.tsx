import path from 'path';
import pino from 'pino';
import React from 'react';
import { Toolkit } from '@arcanejs/toolkit';

import {
  CoreComponents,
  ToolkitRenderer,
  prepareComponents,
} from '@arcanejs/react-toolkit';
import { Base } from '@arcanejs/toolkit/components/base';
import { IDMap } from '@arcanejs/toolkit/util';
import { LtcDemoComponentProto } from './custom-proto';

const toolkit = new Toolkit({
  log: pino({
    level: 'debug',
    transport: {
      target: 'pino-pretty',
    },
  }),
  entrypointJsFile: path.resolve(__dirname, 'dist/custom-entrypoint.js'),
});

toolkit.start({
  mode: 'automatic',
  port: 1330,
});

class LtcDemoComponent extends Base<
  'custom',
  LtcDemoComponentProto,
  Record<never, never>,
  'request-time'
> {
  public getProtoInfo(idMap: IDMap): LtcDemoComponentProto {
    return {
      namespace: 'custom',
      component: 'ltc',
      key: idMap.getId(this),
    };
  }
}

const C = prepareComponents('custom', {
  LtcDemoComponent,
});

ToolkitRenderer.render(
  <C.LtcDemoComponent />,
  toolkit,
  {},
  {
    componentNamespaces: [CoreComponents, C],
  },
);
