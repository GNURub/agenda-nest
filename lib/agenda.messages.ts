export const NO_QUEUE_FOUND = (name?: string) =>
  name
    ? `No Agenda queue was found with the given name (${name}). Check your configuration.`
    : 'No Agenda queue was found. Check your configuration.';

export const UNKNOWN_BACKEND = (type: string) =>
  `Unsupported Agenda backend type (${type}). Use mongo, postgres, redis, or a custom backend factory.`;

export const BACKEND_PACKAGE_REQUIRED = (packageName: string) =>
  `Missing optional backend package ${packageName}. Install it in the consuming application to use this backend.`;

export const ASYNC_CONFIG_REQUIRED =
  'Async Agenda configuration requires exactly one of useFactory, useClass, or useExisting.';

export const ROOT_BACKEND_REQUIRED =
  'Agenda root configuration requires a backend definition.';

export const CUSTOM_BACKEND_FACTORY_REQUIRED =
  'Custom Agenda backend configuration requires a factory function.';
