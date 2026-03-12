type AgendaModule = typeof import('agenda');
type MongoBackendModule = typeof import('@agendajs/mongo-backend');
type PostgresBackendModule = typeof import('@agendajs/postgres-backend');
type RedisBackendModule = typeof import('@agendajs/redis-backend');

const importModule = new Function('specifier', 'return import(specifier);') as <
  TModule,
>(
  specifier: string,
) => Promise<TModule>;

export const loadAgendaModule = () => importModule<AgendaModule>('agenda');

export const loadMongoBackendModule = () =>
  importModule<MongoBackendModule>('@agendajs/mongo-backend');

export const loadPostgresBackendModule = () =>
  importModule<PostgresBackendModule>('@agendajs/postgres-backend');

export const loadRedisBackendModule = () =>
  importModule<RedisBackendModule>('@agendajs/redis-backend');
