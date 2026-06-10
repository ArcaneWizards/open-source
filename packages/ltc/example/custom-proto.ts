import { BaseComponentProto, AnyComponentProto } from '@arcanejs/protocol';

export const CUSTOM_NAMESPACE = 'custom';

export type LtcDemoComponentProto = BaseComponentProto<
  typeof CUSTOM_NAMESPACE,
  'ltc'
>;

export type CustomComponent = LtcDemoComponentProto;

export const isCustomComponent = (
  component: AnyComponentProto,
): component is CustomComponent => component.namespace === CUSTOM_NAMESPACE;
