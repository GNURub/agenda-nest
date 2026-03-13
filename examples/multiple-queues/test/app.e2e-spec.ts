import { Test, TestingModule } from '@nestjs/testing';

class FakeMongoBackend {
  readonly name = 'MongoDB';

  readonly repository = {} as any;

  readonly ownsConnection = true;

  constructor(readonly config: Record<string, unknown>) {}

  async connect() {}

  async disconnect() {}
}

class FakeAgenda {
  readonly ready = Promise.resolve();

  readonly attrs: Record<string, unknown>;

  readonly backend: FakeMongoBackend;

  readonly every = vi.fn().mockResolvedValue(undefined);

  readonly schedule = vi.fn().mockResolvedValue(undefined);

  readonly now = vi.fn().mockResolvedValue(undefined);

  readonly start = vi.fn().mockResolvedValue(undefined);

  readonly stop = vi.fn().mockResolvedValue(undefined);

  readonly on = vi.fn().mockReturnThis();

  readonly once = vi.fn().mockReturnThis();

  readonly off = vi.fn().mockReturnThis();

  readonly removeListener = vi.fn().mockReturnThis();

  constructor(config: Record<string, unknown>) {
    this.attrs = config;
    this.backend = config.backend as FakeMongoBackend;
  }

  define() {}
}

vi.mock('../../../lib/loaders/agenda.loader', () => ({
  loadAgendaModule: async () => ({ Agenda: FakeAgenda }),
  loadMongoBackendModule: async () => ({ MongoBackend: FakeMongoBackend }),
  loadPostgresBackendModule: async () => ({
    PostgresBackend: class UnsupportedPostgresBackend {},
  }),
  loadRedisBackendModule: async () => ({
    RedisBackend: class UnsupportedRedisBackend {},
  }),
}));

vi.mock('@gnurub/agenda-nest', async () => import('../../../lib/index'));

const { AppModule } = await import('./../src/app.module');

describe('AppController (e2e)', () => {
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await moduleFixture.init();
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should boot the example queues with the root package alias', () => {
    const notificationsAgenda = moduleFixture.get<any>(
      'notifications-queue:raw',
      {
        strict: false,
      },
    );
    const reportsAgenda = moduleFixture.get<any>('reports-queue:raw', {
      strict: false,
    });

    expect(notificationsAgenda.attrs.name).toBe('notifications');
    expect(reportsAgenda.attrs.name).toBe('reports');
    expect(notificationsAgenda.start).toHaveBeenCalledTimes(1);
    expect(reportsAgenda.every).toHaveBeenCalledWith(
      '1 minute',
      'reports::sendReport',
      {},
      { interval: '1 minute' },
    );
  });
});
