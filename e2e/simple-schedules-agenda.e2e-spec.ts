import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendaModule, AgendaQueue } from '../lib';
import {
  FinishJobHandler,
  SimpleScheduleService,
  StartJobHandler,
} from './simple-schedules.handlers';

vi.mock('../lib/loaders/agenda.loader', () => ({
  loadAgendaModule: () => import('agenda'),
  loadMongoBackendModule: () => import('@agendajs/mongo-backend'),
  loadPostgresBackendModule: () => import('@agendajs/postgres-backend'),
  loadRedisBackendModule: () => import('@agendajs/redis-backend'),
}));

describe('Simple schedules example', () => {
  let mongoServer: MongoMemoryServer;
  let moduleRef: TestingModule;
  let scheduler: SimpleScheduleService;
  let startedQueue: AgendaQueue;
  let finishedQueue: AgendaQueue;
  let startedRawAgenda: any;
  let finishedRawAgenda: any;
  let startHandler: StartJobHandler;
  let finishHandler: FinishJobHandler;

  const waitFor = async (
    predicate: () => boolean | Promise<boolean>,
    timeoutMs = 15_000,
    intervalMs = 50,
  ) => {
    const startedAt = Date.now();

    while (!(await predicate())) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out after ${timeoutMs}ms`);
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  };

  beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();

    moduleRef = await Test.createTestingModule({
      imports: [
        AgendaModule.forRoot({
          processEvery: 50,
          backend: {
            type: 'mongo',
            options: {
              address: mongoServer.getUri(),
              ensureIndex: false,
            },
          },
        }),
        AgendaModule.registerQueue('started', {
          autoStart: true,
        }),
        AgendaModule.registerQueue('finished'),
      ],
      providers: [SimpleScheduleService, StartJobHandler, FinishJobHandler],
    }).compile();

    await moduleRef.init();

    scheduler = moduleRef.get(SimpleScheduleService);
    startedQueue = moduleRef.get<AgendaQueue>('started-queue', {
      strict: false,
    });
    finishedQueue = moduleRef.get<AgendaQueue>('finished-queue', {
      strict: false,
    });
    startedRawAgenda = moduleRef.get<any>('started-queue:raw', {
      strict: false,
    });
    finishedRawAgenda = moduleRef.get<any>('finished-queue:raw', {
      strict: false,
    });
    startHandler = moduleRef.get(StartJobHandler);
    finishHandler = moduleRef.get(FinishJobHandler);

    await startedRawAgenda.ready;
    await finishedRawAgenda.ready;
  }, 60_000);

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 60_000);

  it('programa ambos jobs con fechas futuras', async () => {
    const startedAt = new Date(Date.now() + 300);
    const finishedAt = new Date(Date.now() + 900);

    await scheduler.schedule({
      reqId: 'req-123',
      startAt: startedAt,
      endPlus24HoursAt: finishedAt,
    });

    await waitFor(async () => {
      const result = await startedQueue.queryJobs({
        name: 'start-job',
        limit: 1,
      });
      return result.total >= 1;
    });
    await waitFor(async () => {
      const result = await finishedQueue.queryJobs({
        name: 'finish-job',
        limit: 1,
      });
      return result.total >= 1;
    });

    const startedResult = await startedQueue.queryJobs({
      name: 'start-job',
      limit: 1,
    });
    const finishedResult = await finishedQueue.queryJobs({
      name: 'finish-job',
      limit: 1,
    });

    expect(startedResult.jobs[0].name).toBe('start-job');
    expect(startedResult.jobs[0].data).toEqual({ reqId: 'req-123' });
    expect(finishedResult.jobs[0].name).toBe('finish-job');
    expect(finishedResult.jobs[0].data).toEqual({ reqId: 'req-123' });

    await waitFor(() => startHandler.handled.includes('req-123'), 10_000, 50);
    await waitFor(() => finishHandler.handled.includes('req-123'), 10_000, 50);

    expect(startHandler.handled).toEqual(['req-123']);
    expect(finishHandler.handled).toEqual(['req-123']);
  }, 20_000);

  it('hace fallback cuando las fechas ya han pasado', async () => {
    const before = Date.now();

    await scheduler.schedule({
      reqId: 'req-456',
      startAt: new Date(before - 86_400_000),
      endPlus24HoursAt: new Date(before - 3_600_000),
    });

    await waitFor(async () => {
      const result = await startedQueue.queryJobs({
        name: 'start-job',
        limit: 1,
      });
      return result.total >= 1;
    });
    await waitFor(async () => {
      const result = await finishedQueue.queryJobs({
        name: 'finish-job',
        limit: 1,
      });
      return result.total >= 1;
    });

    const after = Date.now();
    const startedResult = await startedQueue.queryJobs({
      name: 'start-job',
      limit: 1,
    });
    const finishedResult = await finishedQueue.queryJobs({
      name: 'finish-job',
      limit: 1,
    });
    const startedNextRunAt = startedResult.jobs[0].nextRunAt;
    const finishedNextRunAt = finishedResult.jobs[0].nextRunAt;
    const expectedFinish = new Date(after);

    expectedFinish.setUTCHours(24, 0, 59, 999);

    expect(startedResult.jobs[0].name).toBe('start-job');
    expect(startedResult.jobs[0].data).toEqual({ reqId: 'req-456' });
    expect(startedNextRunAt).not.toBeNull();
    expect(startedNextRunAt!.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(startedNextRunAt!.getTime()).toBeLessThanOrEqual(after + 61_000);
    expect(finishedResult.jobs[0].name).toBe('finish-job');
    expect(finishedResult.jobs[0].data).toEqual({ reqId: 'req-456' });
    expect(finishedNextRunAt).not.toBeNull();
    expect(finishedNextRunAt!.getTime()).toBe(expectedFinish.getTime());

    expect(startHandler.handled).toEqual([]);
    expect(finishHandler.handled).toEqual([]);
  });

  it('no programa nada sin reqId', async () => {
    await scheduler.schedule({
      reqId: '   ',
      startAt: new Date('2026-03-14T08:00:00.000Z'),
      endPlus24HoursAt: new Date('2026-03-16T12:00:00.000Z'),
    });

    const startedResult = await startedQueue.queryJobs({
      name: 'start-job',
      limit: 1,
    });
    const finishedResult = await finishedQueue.queryJobs({
      name: 'finish-job',
      limit: 1,
    });

    expect(startedResult.total).toBe(0);
    expect(finishedResult.total).toBe(0);
    expect(startHandler.handled).toEqual([]);
    expect(finishHandler.handled).toEqual([]);
  });
});
