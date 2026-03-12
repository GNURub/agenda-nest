import { AgendaQueue } from './agenda.queue';

describe('AgendaQueue', () => {
  it('should namespace manual scheduling calls', async () => {
    const payload = {
      to: 'user@example.com',
      metadata: { locale: 'en-US' },
    };
    const options = {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      skipDays: [0, 6],
    };
    const agenda = {
      schedule: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    await queue.schedule(
      'tomorrow at noon',
      'sendNotification',
      payload,
      options,
    );

    expect(agenda.schedule).toHaveBeenCalledWith(
      'tomorrow at noon',
      'notifications::sendNotification',
      payload,
      options,
    );
    expect(agenda.schedule.mock.calls[0][2]).toBe(payload);
    expect(agenda.schedule.mock.calls[0][3]).toBe(options);
  });

  it('should namespace recurring scheduling calls and preserve payload/options', async () => {
    const payload = {
      kind: 'digest',
      recipients: ['ops@example.com'],
    };
    const options = {
      timezone: 'UTC',
      skipImmediate: true,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: '2026-12-31T23:59:59.000Z',
      skipDays: [0, 6],
    };
    const agenda = {
      every: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    await queue.every('15 minutes', 'sendDigest', payload, options);

    expect(agenda.every).toHaveBeenCalledWith(
      '15 minutes',
      'notifications::sendDigest',
      payload,
      options,
    );
    expect(agenda.every.mock.calls[0][2]).toBe(payload);
    expect(agenda.every.mock.calls[0][3]).toBe(options);
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
    const jobData = {
      to: 'user@example.com',
      nested: { retries: 1 },
    };
    const agenda = {
      queryJobs: vi.fn().mockResolvedValue({
        total: 1,
        jobs: [
          {
            _id: '1',
            name: 'notifications::sendNotification',
            data: jobData,
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
    expect(result.jobs[0].data).toBe(jobData);
  });

  it('should namespace create calls', () => {
    const payload = {
      to: 'user@example.com',
      metadata: { priority: 'high' },
    };
    const createdJob = {
      attrs: {
        name: 'notifications::sendNotification',
        data: payload,
      },
    };
    const agenda = {
      create: vi.fn().mockReturnValue(createdJob),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    const result = queue.create('sendNotification', payload);

    expect(agenda.create).toHaveBeenCalledWith(
      'notifications::sendNotification',
      payload,
    );
    expect(agenda.create.mock.calls[0][1]).toBe(payload);
    expect(result).toBe(createdJob);
  });

  it('should namespace immediate jobs and preserve payload references', async () => {
    const payload = {
      userId: 'user-1',
      channels: ['email', 'sms'],
    };
    const agenda = {
      now: vi.fn().mockResolvedValue(undefined),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    await queue.now('sendNow', payload);

    expect(agenda.now).toHaveBeenCalledWith(
      'notifications::sendNow',
      payload,
    );
    expect(agenda.now.mock.calls[0][1]).toBe(payload);
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
    const payload = {
      ok: true,
      metadata: { retries: 2 },
    };
    const nextRunAt = new Date('2026-02-01T10:00:00.000Z');
    let originalJob: any;

    class FakeJob {
      constructor(public attrs: Record<string, unknown>) { }

      touch() {
        return 'touched';
      }
    }

    const listener = vi.fn();
    const agenda = {
      on: vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
        if (eventName === 'complete:notifications::sendNotification') {
          originalJob = new FakeJob({
            name: 'notifications::sendNotification',
            data: payload,
            failCount: 2,
            nextRunAt,
          });

          handler(originalJob);
        }
      }),
      once: vi.fn(
        (eventName: string, handler: (...args: unknown[]) => void) => {
          if (eventName === 'success:notifications::sendNotification') {
            handler(
              new FakeJob({
                name: 'notifications::sendNotification',
                data: { ok: false },
              }),
            );
          }
        },
      ),
      off: vi.fn(),
      removeListener: vi.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    queue.on('complete:sendNotification', listener);
    queue.once('success:sendNotification', listener);

    const normalizedJob = listener.mock.calls[0][0];

    expect(normalizedJob).not.toBe(originalJob);
    expect(normalizedJob).toBeInstanceOf(FakeJob);
    expect(normalizedJob.attrs).toEqual({
      name: 'sendNotification',
      data: payload,
      failCount: 2,
      nextRunAt,
    });
    expect(normalizedJob.attrs.data).toBe(payload);
    expect(normalizedJob.touch()).toBe('touched');

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
