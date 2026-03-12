export const NO_QUEUE_FOUND = (name?: string) =>
  name
    ? `No Agenda queue was found with the given name (${name}). Check your configuration.`
    : 'No Agenda queue was found. Check your configuration.';

export const UNKNOWN_BACKEND = (type: string) =>
  `Unsupported Agenda backend type (${type}). Use mongo, postgres, redis, or a custom backend factory.`;

export const BACKEND_PACKAGE_REQUIRED = (packageName: string) =>
  `Missing optional backend package ${packageName}. Install it in the consuming application to use this backend.`;
