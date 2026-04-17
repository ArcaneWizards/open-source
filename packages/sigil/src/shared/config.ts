import z from 'zod';

export const APP_LISTENER_CONFIG = z.object({
  port: z.union([
    z.number().int().min(1).max(65535),
    z
      .object({
        from: z.number().int().min(1).max(65535),
        to: z.number().int().min(1).max(65535),
      })
      .refine((data) => data.to >= data.from, {
        message: '"to" must be greater than or equal to "from"',
      }),
  ]),
  interface: z.string().optional(),
});

export type ListenerConfig = z.infer<typeof APP_LISTENER_CONFIG>;

export const ALL_APP_LISTENER_CONFIG = z.record(
  z.string(),
  APP_LISTENER_CONFIG,
);

export type AllListenerConfig = z.infer<typeof ALL_APP_LISTENER_CONFIG>;

export const portString = (port: ListenerConfig['port']): string => {
  if (typeof port === 'number') {
    return port.toString();
  }
  return `${port.from}-${port.to}`;
};
