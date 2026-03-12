import { AgendaQueue } from './agenda.queue';

describe('AgendaQueue', () => {
  it('should namespace manual scheduling calls', async () => {
    const agenda = {
      schedule: jest.fn(),
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
      on: jest.fn(),
    } as any;

    const queue = new AgendaQueue(agenda, 'notifications');

    queue.on('complete:sendNotification', jest.fn());

    expect(agenda.on).toHaveBeenCalledWith(
      'complete:notifications::sendNotification',
      expect.any(Function),
    );
  });

  it('should strip namespace from queried jobs', async () => {
    const agenda = {
      queryJobs: jest.fn().mockResolvedValue({
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
});
