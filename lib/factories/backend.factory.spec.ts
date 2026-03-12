import { BACKEND_PACKAGE_REQUIRED, UNKNOWN_BACKEND } from '../agenda.messages';
import {
  loadMongoBackendModule,
  loadPostgresBackendModule,
  loadRedisBackendModule,
} from '../loaders/agenda.loader';
import { createAgendaBackend } from './backend.factory';

vi.mock('../loaders/agenda.loader', () => ({
  loadMongoBackendModule: vi.fn(),
  loadPostgresBackendModule: vi.fn(),
  loadRedisBackendModule: vi.fn(),
}));

const loadMongoBackendModuleMock = loadMongoBackendModule as any;
const loadPostgresBackendModuleMock = loadPostgresBackendModule as any;
const loadRedisBackendModuleMock = loadRedisBackendModule as any;

describe('createAgendaBackend', () => {
  const context = {
    queueName: 'jobs',
    namespace: 'jobs',
    collectionName: 'jobs-queue',
    rootConfig: {
      processEvery: 100,
      backend: {
        type: 'mongo' as const,
        options: { address: 'mongodb://example.test/agenda' },
      },
    },
    queueConfig: {},
  };

  beforeEach(() => {
    loadMongoBackendModuleMock.mockReset();
    loadPostgresBackendModuleMock.mockReset();
    loadRedisBackendModuleMock.mockReset();
  });

  it('should resolve function based backends', async () => {
    const backend = { name: 'custom' } as any;

    await expect(
      createAgendaBackend(() => backend, context as any),
    ).resolves.toBe(backend);
  });

  it('should resolve custom backend definitions', async () => {
    const backend = { name: 'custom' } as any;

    await expect(
      createAgendaBackend(
        {
          type: 'custom',
          factory: () => backend,
        },
        context as any,
      ),
    ).resolves.toBe(backend);
  });

  it('should instantiate builtin mongo backends with queue collection fallback', async () => {
    class MongoBackend {
      constructor(readonly config: Record<string, unknown>) {}
    }

    loadMongoBackendModuleMock.mockResolvedValue({
      MongoBackend,
    } as any);

    const backend = (await createAgendaBackend(
      {
        type: 'mongo',
        options: { address: 'mongodb://example.test/agenda' },
      },
      context as any,
    )) as MongoBackend;

    expect(backend.config).toEqual({
      address: 'mongodb://example.test/agenda',
      collection: 'jobs-queue',
    });
  });

  it('should map missing builtin dependencies to actionable errors', async () => {
    loadRedisBackendModuleMock.mockRejectedValue(
      new Error('Cannot find module @agendajs/redis-backend'),
    );

    await expect(
      createAgendaBackend(
        {
          type: 'redis',
          options: { address: 'redis://localhost:6379' } as any,
        },
        context as any,
      ),
    ).rejects.toThrow(BACKEND_PACKAGE_REQUIRED('@agendajs/redis-backend'));
  });

  it('should reject unknown backend values', async () => {
    await expect(
      createAgendaBackend('invalid' as any, context as any),
    ).rejects.toThrow(UNKNOWN_BACKEND('invalid'));
  });
});
