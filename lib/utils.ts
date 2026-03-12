export const getQueueToken = (name?: string) =>
  name ? `${name}-queue` : `agenda-queue`;

export const getRawQueueToken = (name?: string) =>
  name ? `${name}-queue:raw` : `agenda-queue:raw`;

export const getQueueConfigToken = (name?: string): string =>
  `AgendaQueueOptions_${name}`;

export const getQueueCollectionName = (name?: string, collection?: string) =>
  collection || getQueueToken(name);

export const getQueueNamespace = (name?: string, namespace?: string) =>
  namespace || name || 'default';

export const getQualifiedJobName = (namespace: string, jobName: string) => {
  const prefix = `${namespace}::`;

  return jobName.startsWith(prefix) ? jobName : `${prefix}${jobName}`;
};

export const getUnqualifiedJobName = (namespace: string, jobName: string) => {
  const prefix = `${namespace}::`;

  return jobName.startsWith(prefix) ? jobName.slice(prefix.length) : jobName;
};

export const getQualifiedEventName = (namespace: string, eventName: string) => {
  const separatorIndex = eventName.indexOf(':');

  if (separatorIndex === -1) {
    return eventName;
  }

  const eventType = eventName.slice(0, separatorIndex);
  const jobName = eventName.slice(separatorIndex + 1);

  return `${eventType}:${getQualifiedJobName(namespace, jobName)}`;
};

export const cloneWithPrototype = <T extends object>(value: T): T => {
  const clone = Object.create(Object.getPrototypeOf(value)) as T;

  return Object.assign(clone, value);
};
