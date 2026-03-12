import type { MongoBackendConfig } from '@agendajs/mongo-backend';
import type { PostgresBackendConfig } from '@agendajs/postgres-backend';
import type { RedisBackendConfig } from '@agendajs/redis-backend';
import {
  FactoryProvider,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';
import type { AgendaBackend, AgendaOptions } from 'agenda';

export type AgendaRuntimeConfig = Omit<AgendaOptions, 'backend'>;

export type AgendaBuiltinBackendType = 'mongo' | 'postgres' | 'redis';

export interface AgendaBackendFactoryContext {
  queueName?: string;
  namespace: string;
  collectionName: string;
  rootConfig: AgendaModuleConfig;
  queueConfig: AgendaQueueConfig;
}

export type AgendaBackendFactory = (
  context: AgendaBackendFactoryContext,
) => Promise<AgendaBackend> | AgendaBackend;

export type AgendaBuiltinBackendDefinition =
  | {
      type: 'mongo';
      options: MongoBackendConfig;
    }
  | {
      type: 'postgres';
      options: PostgresBackendConfig;
    }
  | {
      type: 'redis';
      options: RedisBackendConfig;
    };

export type AgendaBackendDefinition =
  | AgendaBuiltinBackendDefinition
  | {
      type: 'custom';
      factory: AgendaBackendFactory;
    }
  | AgendaBackendFactory;

export type AgendaModuleConfig = AgendaRuntimeConfig & {
  backend: AgendaBackendDefinition;
};

export type AgendaQueueConfig = Partial<AgendaRuntimeConfig> & {
  backend?: AgendaBackendDefinition;
  autoStart?: boolean;
  collection?: string;
  namespace?: string;
};

export interface AgendaConfigFactory<T> {
  createAgendaConfig(): Promise<T> | T;
}

export interface AgendaModuleAsyncConfig<T> extends Pick<
  ModuleMetadata,
  'imports'
> {
  useExisting?: Type<AgendaConfigFactory<T>>;
  useClass?: Type<AgendaConfigFactory<T>>;
  useFactory?: (...args: any[]) => Promise<T> | T;
  inject?: FactoryProvider['inject'];
  extraProviders?: Provider[];
}
