import type { AgendaBackend } from 'agenda';
import { BACKEND_PACKAGE_REQUIRED, UNKNOWN_BACKEND } from '../agenda.messages';
import type {
  AgendaBackendDefinition,
  AgendaBackendFactoryContext,
  AgendaBuiltinBackendDefinition,
} from '../interfaces';
import {
  loadMongoBackendModule,
  loadPostgresBackendModule,
  loadRedisBackendModule,
} from '../loaders/agenda.loader';

const isBuiltinBackendDefinition = (
  backend: AgendaBackendDefinition,
): backend is
  | AgendaBuiltinBackendDefinition
  | {
      type: 'custom';
      factory: (
        context: AgendaBackendFactoryContext,
      ) => Promise<AgendaBackend> | AgendaBackend;
    } => typeof backend === 'object' && backend !== null && 'type' in backend;

const withQueueMongoOptions = (
  definition: Extract<AgendaBuiltinBackendDefinition, { type: 'mongo' }>,
  context: AgendaBackendFactoryContext,
) => ({
  ...definition.options,
  collection:
    context.queueConfig.collection ||
    definition.options.collection ||
    context.collectionName,
});

const getMissingOptionalDependencyError = (
  packageName: string,
  error: unknown,
) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes(packageName)) {
    return new Error(BACKEND_PACKAGE_REQUIRED(packageName));
  }

  return error;
};

export async function createAgendaBackend(
  definition: AgendaBackendDefinition,
  context: AgendaBackendFactoryContext,
): Promise<AgendaBackend> {
  if (typeof definition === 'function') {
    return definition(context);
  }

  if (!isBuiltinBackendDefinition(definition)) {
    throw new Error(UNKNOWN_BACKEND(String(definition)));
  }

  if (definition.type === 'custom') {
    return definition.factory(context);
  }

  try {
    if (definition.type === 'mongo') {
      const { MongoBackend } = await loadMongoBackendModule();
      return new MongoBackend(
        withQueueMongoOptions(definition, context) as ConstructorParameters<
          typeof MongoBackend
        >[0],
      );
    }

    if (definition.type === 'postgres') {
      const { PostgresBackend } = await loadPostgresBackendModule();
      return new PostgresBackend(
        definition.options as ConstructorParameters<typeof PostgresBackend>[0],
      );
    }

    if (definition.type === 'redis') {
      const { RedisBackend } = await loadRedisBackendModule();
      return new RedisBackend(
        definition.options as ConstructorParameters<typeof RedisBackend>[0],
      );
    }
  } catch (error) {
    if (definition.type === 'mongo') {
      throw getMissingOptionalDependencyError('@agendajs/mongo-backend', error);
    }

    if (definition.type === 'postgres') {
      throw getMissingOptionalDependencyError(
        '@agendajs/postgres-backend',
        error,
      );
    }

    if (definition.type === 'redis') {
      throw getMissingOptionalDependencyError('@agendajs/redis-backend', error);
    }

    throw error;
  }

  throw new Error(UNKNOWN_BACKEND('unknown'));
}
