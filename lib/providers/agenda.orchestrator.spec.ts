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

  it('should define processors, schedule jobs and start queues', async () => {
    const queue = createQueue();
    const orchestrator = new AgendaOrchestrator();

    orchestrator.addQueue('jobs', 'jobs-queue:raw', queue as any, {
      autoStart: true,
      namespace: undefined,
    });
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
    const orchestrator = new AgendaOrchestrator();

    const processor = Object.assign(
      vi.fn((job: unknown, done: () => void) => done()),
      { _name: 'sendEmail' },
    );

    orchestrator.addQueue('jobs', 'jobs-queue:raw', queue as any, {
      autoStart: false,
      namespace: 'custom',
    });
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

  it('should preserve processors when the same queue is discovered more than once', async () => {
    const queue = createQueue();
    const orchestrator = new AgendaOrchestrator();

    orchestrator.addQueue('jobs', 'jobs-queue:raw', queue as any, {
      autoStart: false,
    });
    orchestrator.addJobProcessor(
      'jobs-queue:raw',
      Object.assign(vi.fn(), { _name: 'firstJob' }) as any,
      { interval: '1 minute' },
      JobProcessorType.EVERY,
      false,
    );

    orchestrator.addQueue('jobs', 'jobs-queue:raw', queue as any, {
      autoStart: false,
    });
    orchestrator.addJobProcessor(
      'jobs-queue:raw',
      Object.assign(vi.fn(), { _name: 'secondJob' }) as any,
      { interval: '5 minutes' },
      JobProcessorType.EVERY,
      false,
    );

    await orchestrator.onApplicationBootstrap();

    expect(queue.define).toHaveBeenCalledWith(
      'jobs::firstJob',
      expect.any(Function),
      { interval: '1 minute' },
    );
    expect(queue.define).toHaveBeenCalledWith(
      'jobs::secondJob',
      expect.any(Function),
      { interval: '5 minutes' },
    );
  });

  it('should attempt to stop every queue when one stop fails', async () => {
    const firstQueue = createQueue();
    const secondQueue = createQueue();
    const stopError = new Error('first queue failed to stop');
    firstQueue.stop.mockRejectedValue(stopError);
    const orchestrator = new AgendaOrchestrator();

    orchestrator.addQueue('first', 'first-queue:raw', firstQueue as any, {});
    orchestrator.addQueue('second', 'second-queue:raw', secondQueue as any, {});

    await expect(orchestrator.beforeApplicationShutdown()).rejects.toBe(
      stopError,
    );
    expect(firstQueue.stop).toHaveBeenCalledTimes(1);
    expect(secondQueue.stop).toHaveBeenCalledTimes(1);
  });

  it('should log rejected ready listeners without an unhandled rejection', async () => {
    const queue = createQueue();
    const orchestrator = new AgendaOrchestrator();
    const listenerError = new Error('listener failed');
    const logger = (orchestrator as any).logger;
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    orchestrator.addQueue('jobs', 'jobs-queue:raw', queue as any, {});
    orchestrator.addEventListener(
      'jobs-queue:raw',
      () => Promise.reject(listenerError),
      'ready',
    );

    await orchestrator.onApplicationBootstrap();
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      'Agenda ready listener failed',
      listenerError,
    );
  });
});
