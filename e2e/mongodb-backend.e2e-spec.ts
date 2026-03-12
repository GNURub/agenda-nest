import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AgendaModule, AgendaQueue } from '../lib';
import { EmailPayload, MongoJobsHandler } from './mongodb.jobs.handler';

vi.mock('../lib/loaders/agenda.loader', () => ({
  loadAgendaModule: () => import('agenda'),
  loadMongoBackendModule: () => import('@agendajs/mongo-backend'),
  loadPostgresBackendModule: () => import('@agendajs/postgres-backend'),
  loadRedisBackendModule: () => import('@agendajs/redis-backend'),
}));

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

describe('AgendaModule MongoDB backend (e2e)', () => {
  let mongoServer: MongoMemoryServer;
  let testingModule: TestingModule;
  let queue: AgendaQueue;
  let rawAgenda: any;
  let jobsHandler: MongoJobsHandler;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    testingModule = await Test.createTestingModule({
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
        AgendaModule.registerQueue('jobs'),
      ],
      providers: [MongoJobsHandler],
    }).compile();

    await testingModule.init();

    queue = testingModule.get<AgendaQueue>('jobs-queue', { strict: false });
    rawAgenda = testingModule.get<any>('jobs-queue:raw', { strict: false });
    jobsHandler = testingModule.get(MongoJobsHandler);

    await rawAgenda.ready;
  }, 60_000);

  beforeEach(async () => {
    jobsHandler.reset();
    await rawAgenda.cancel({});
  });

  afterAll(async () => {
    if (testingModule) {
      await testingModule.close();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 60_000);

  it('persists scheduled payloads in MongoDB and exposes them through queryJobs', async () => {
    const payload: EmailPayload = {
      to: 'future@example.com',
      nested: { attempt: 1 },
    };
    const when = new Date(Date.now() + 60_000);

    await jobsHandler.scheduleInFuture(payload, when);

    await waitFor(async () => {
      const result = await queue.queryJobs({ name: 'send-email', limit: 1 });
      return result.total >= 1;
    });

    const result = await queue.queryJobs({ name: 'send-email', limit: 1 });

    expect(result.total).toBe(1);
    expect(result.jobs[0].name).toBe('send-email');
    expect(result.jobs[0].data).toEqual(payload);
  }, 30_000);

  it('executes immediate jobs against MongoDB and keeps attrs.data intact', async () => {
    const payload: EmailPayload = {
      to: 'now@example.com',
      nested: { attempt: 2 },
    };

    await jobsHandler.runNow(payload);

    await waitFor(() => jobsHandler.processedJobs.length === 1);
    await waitFor(() => jobsHandler.successEvents.length === 1);

    expect(jobsHandler.processedJobs[0]).toEqual({
      name: 'jobs::send-email',
      data: payload,
      failCount: undefined,
    });
    expect(jobsHandler.successEvents[0]).toEqual({
      name: 'jobs::send-email',
      data: payload,
      failCount: undefined,
    });
  }, 30_000);
});
