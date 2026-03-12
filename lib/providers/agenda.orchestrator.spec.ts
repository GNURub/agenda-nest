import { ModuleRef } from '@nestjs/core';
import { JobProcessorType } from '../enums';
import { AgendaOrchestrator } from './agenda.orchestrator';

describe('AgendaOrchestrator', () => {
  const createQueue = () => ({
    ready: Promise.resolve(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    every: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue(undefined),
    now: vi.fn().mockResolvedValue(undefined),
    define: vi.fn(),
    on: vi.fn(),
  });

  const createModuleRef = (
    queue = createQueue(),
    config = { autoStart: true, namespace: undefined },
  ) =>
    ({
      get: vi.fn((token: string) => {
        if (token === 'jobs-queue:raw') {
          return queue;
        }

        if (token === 'AgendaQueueOptions_jobs') {
          return config;
        }

        throw new Error(`Unknown token ${token}`);
      }),
    }) as unknown as ModuleRef;

  it('should define processors, schedule jobs and start queues', async () => {
    const queue = createQueue();
    const orchestrator = new AgendaOrchestrator(createModuleRef(queue));

    orchestrator.addQueue('jobs', 'jobs-queue:raw', 'AgendaQueueOptions_jobs');
    orchestrator.addJobProcessor(
      'jobs-queue:raw',
      Object.assign(vi.fn(), { _name: 'sendEmail' }) as any,
      { interval: '1 minute' },
      JobProcessorType.EVERY,
      false,
    );
    orchestrator.addJobProcessor(
      'jobs-queue:raw',
      Object.assign(vi.fn(), { _name: 'sendDigest' }) as any,
      { when: 'tomorrow' },
      JobProcessorType.SCHEDULE,
      false,
    );
    orchestrator.addJobProcessor(
      'jobs-queue:raw',
      Object.assign(vi.fn(), { _name: 'sendNow' }) as any,
      { name: 'sendNow' },
      JobProcessorType.NOW,
      false,
    );
    const readyListener = vi.fn();
    orchestrator.addEventListener('jobs-queue:raw', readyListener, 'ready');
    const completeListener = vi.fn();
    orchestrator.addEventListener(
      'jobs-queue:raw',
      completeListener,
      'complete',
      'sendEmail',
    );

    await orchestrator.onApplicationBootstrap();

    expect(queue.define).toHaveBeenCalledWith(
      'jobs::sendEmail',
      expect.any(Function),
      { interval: '1 minute' },
    );
    expect(queue.every).toHaveBeenCalledWith(
      '1 minute',
      'jobs::sendEmail',
      {},
      { interval: '1 minute' },
    );
    expect(queue.schedule).toHaveBeenCalledWith(
      'tomorrow',
      'jobs::sendDigest',
      {},
      { when: 'tomorrow' },
    );
    expect(queue.now).toHaveBeenCalledWith('jobs::sendNow', {});
    expect(queue.on).toHaveBeenCalledWith(
      'complete:jobs::sendEmail',
      completeListener,
    );
    expect(readyListener).toHaveBeenCalledTimes(1);
    expect(queue.start).toHaveBeenCalledTimes(1);

    await orchestrator.beforeApplicationShutdown();

    expect(queue.stop).toHaveBeenCalledTimes(1);
  });

  it('should wrap callback processors when requested and skip auto start', async () => {
    const queue = createQueue();
    const orchestrator = new AgendaOrchestrator(
      createModuleRef(queue, { autoStart: false, namespace: 'custom' }),
    );

    const processor = Object.assign(
      vi.fn((job: unknown, done: () => void) => done()),
      { _name: 'sendEmail' },
    );

    orchestrator.addQueue('jobs', 'jobs-queue:raw', 'AgendaQueueOptions_jobs');
    orchestrator.addJobProcessor(
      'jobs-queue:raw',
      processor as any,
      { interval: '1 minute' },
      JobProcessorType.DEFINE,
      true,
    );

    await orchestrator.onApplicationBootstrap();

    const wrappedProcessor = queue.define.mock.calls[0][1];
    const done = vi.fn();
    wrappedProcessor({ attrs: {} }, done);

    expect(processor).toHaveBeenCalled();
    expect(queue.start).not.toHaveBeenCalled();
  });
});
