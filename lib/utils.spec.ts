import {
  cloneWithPrototype,
  getQualifiedEventName,
  getQualifiedJobName,
  getQueueCollectionName,
  getQueueConfigToken,
  getQueueNamespace,
  getQueueToken,
  getRawQueueToken,
  getUnqualifiedJobName,
} from './utils';

describe('utils', () => {
  it('should build tokens and collection names', () => {
    expect(getQueueToken('jobs')).toBe('jobs-queue');
    expect(getQueueToken()).toBe('agenda-queue');
    expect(getRawQueueToken('jobs')).toBe('jobs-queue:raw');
    expect(getQueueConfigToken('jobs')).toBe('AgendaQueueOptions_jobs');
    expect(getQueueCollectionName('jobs')).toBe('jobs-queue');
    expect(getQueueCollectionName('jobs', 'custom')).toBe('custom');
  });

  it('should manage namespaces and job names', () => {
    expect(getQueueNamespace('jobs')).toBe('jobs');
    expect(getQueueNamespace(undefined, 'custom')).toBe('custom');
    expect(getQueueNamespace()).toBe('default');
    expect(getQualifiedJobName('jobs', 'sendEmail')).toBe('jobs::sendEmail');
    expect(getQualifiedJobName('jobs', 'jobs::sendEmail')).toBe(
      'jobs::sendEmail',
    );
    expect(getUnqualifiedJobName('jobs', 'jobs::sendEmail')).toBe('sendEmail');
    expect(getQualifiedEventName('jobs', 'complete:sendEmail')).toBe(
      'complete:jobs::sendEmail',
    );
    expect(getQualifiedEventName('jobs', 'ready')).toBe('ready');
  });

  it('should clone objects preserving their prototype', () => {
    class Example {
      constructor(public readonly value: string) {}

      read() {
        return this.value;
      }
    }

    const source = new Example('hello');
    const clone = cloneWithPrototype(source);

    expect(clone).not.toBe(source);
    expect(clone).toBeInstanceOf(Example);
    expect(clone.read()).toBe('hello');
  });
});
