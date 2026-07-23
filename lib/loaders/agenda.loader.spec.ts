import {
  loadAgendaModule,
  loadMongoBackendModule,
  loadPostgresBackendModule,
  loadRedisBackendModule,
} from './agenda.loader';

describe('Agenda module loaders', () => {
  it('should load Agenda and each supported backend', async () => {
    const [agenda, mongo, postgres, redis] = await Promise.all([
      loadAgendaModule(),
      loadMongoBackendModule(),
      loadPostgresBackendModule(),
      loadRedisBackendModule(),
    ]);

    expect(agenda.Agenda).toBeTypeOf('function');
    expect(mongo.MongoBackend).toBeTypeOf('function');
    expect(postgres.PostgresBackend).toBeTypeOf('function');
    expect(redis.RedisBackend).toBeTypeOf('function');
  });
});
