import { AgendaQueue } from './agenda.queue';

describe('AgendaQueue', () => {
  it('should namespace manual scheduling calls', async () => {
    const agenda = {
      schedule: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    await queue.schedule('tomorrow at noon', 'sendNotification', {
      to: 'user@example.com',
    });

    expect(agenda.schedule).toHaveBeenCalledWith(
      'tomorrow at noon',
      'notifications::sendNotification',
      { to: 'user@example.com' },
      undefined,
    );
  });

  it('should namespace named event subscriptions', () => {
    const agenda = {
      on: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    queue.on('complete:sendNotification', vi.fn());

    expect(agenda.on).toHaveBeenCalledWith(
      'complete:notifications::sendNotification',
      expect.any(Function),
    );
  });

  it('should strip namespace from queried jobs', async () => {
    const agenda = {
      queryJobs: vi.fn().mockResolvedValue({
        total: 1,
        jobs: [
          {
            _id: '1',
            name: 'notifications::sendNotification',
            state: 'queued',
            nextRunAt: null,
            lockedAt: null,
            failCount: 0,
          },
        ],
      }),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');
    const result = await queue.queryJobs({ name: 'sendNotification' });

    expect(agenda.queryJobs).toHaveBeenCalledWith({
      name: 'notifications::sendNotification',
    });
    expect(result.jobs[0].name).toBe('sendNotification');
  });

  it('should namespace create calls', () => {
    const agenda = {
      create: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    queue.create('sendNotification', { to: 'user@example.com' });

    expect(agenda.create).toHaveBeenCalledWith(
      'notifications::sendNotification',
      { to: 'user@example.com' },
    );
  });

  it('should namespace remove queries', async () => {
    const agenda = {
      cancel: vi.fn().mockResolvedValue(2),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    await queue.cancel({
      name: 'sendNotification',
      names: ['sendDigest'],
      notName: 'skipNotification',
      notNames: ['skipDigest'],
    });

    expect(agenda.cancel).toHaveBeenCalledWith({
      name: 'sendNotification',
      names: ['notifications::sendDigest', 'notifications::sendNotification'],
      notName: 'skipNotification',
      notNames: [
        'notifications::skipDigest',
        'notifications::skipNotification',
      ],
    });
  });

  it('should namespace and normalize log queries', async () => {
    const agenda = {
      getLogs: vi.fn().mockResolvedValue({
        total: 1,
        entries: [
          {
            id: '1',
            jobName: 'notifications::sendNotification',
            message: 'done',
          },
        ],
      }),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');
    const result = await queue.getLogs({ jobName: 'sendNotification' } as any);

    expect(agenda.getLogs).toHaveBeenCalledWith({
      jobName: 'notifications::sendNotification',
    });
    expect(result.entries[0].jobName).toBe('sendNotification');
  });

  it('should namespace clear log queries', async () => {
    const agenda = {
      clearLogs: vi.fn().mockResolvedValue(1),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    await queue.clearLogs({ jobName: 'sendNotification' } as any);

    expect(agenda.clearLogs).toHaveBeenCalledWith({
      jobName: 'notifications::sendNotification',
    });
  });

  it('should proxy start stop drain ready and raw agenda', async () => {
    const agenda = {
      ready: Promise.resolve('ready'),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      drain: vi.fn().mockResolvedValue(undefined),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    expect(queue.getRawAgenda()).toBe(agenda);
    await expect(queue.ready).resolves.toBe('ready');

    await queue.start();
    await queue.stop(true);
    await queue.drain({ timeout: 100 });

    expect(agenda.start).toHaveBeenCalled();
    expect(agenda.stop).toHaveBeenCalledWith(true);
    expect(agenda.drain).toHaveBeenCalledWith({ timeout: 100 });
  });

  it('should normalize job payloads received by listeners', () => {
    const listener = vi.fn();
    const agenda = {
      on: vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
        if (eventName === 'complete:notifications::sendNotification') {
          handler({
            attrs: {
              name: 'notifications::sendNotification',
              data: { ok: true },
            },
          });
        }
      }),
      once: vi.fn(
        (eventName: string, handler: (...args: unknown[]) => void) => {
          if (eventName === 'success:notifications::sendNotification') {
            handler({
              attrs: {
                name: 'notifications::sendNotification',
              },
            });
          }
        },
      ),
      off: vi.fn(),
      removeListener: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    queue.on('complete:sendNotification', listener);
    queue.once('success:sendNotification', listener);

    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        attrs: expect.objectContaining({
          name: 'sendNotification',
        }),
      }),
    );
    expect(listener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        attrs: expect.objectContaining({
          name: 'sendNotification',
        }),
      }),
    );

    const offListener = vi.fn();
    queue.off('complete:sendNotification', offListener);
    queue.removeListener('complete:sendNotification', offListener);

    expect(agenda.off).toHaveBeenCalledWith(
      'complete:notifications::sendNotification',
      offListener,
    );
    expect(agenda.removeListener).toHaveBeenCalledWith(
      'complete:notifications::sendNotification',
      offListener,
    );
  });
});
