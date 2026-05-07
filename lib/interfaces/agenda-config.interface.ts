import {
  FactoryProvider,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';
import type { AgendaBackend, AgendaOptions, SortDirection } from 'agenda';

export type AgendaSortDirection = SortDirection;

export type MongoBackendConfig = (
  | {
      mongo: unknown;
    }
  | {
      address: string;
      options?: Record<string, unknown>;
    }
) & {
  collection?: string;
  ensureIndex?: boolean;
  sort?: Record<string, AgendaSortDirection>;
  logCollection?: string;
};

export interface PostgresBackendConfig {
  connectionString?: string;
  poolConfig?: Record<string, unknown>;
  pool?: unknown;
  tableName?: string;
  channelName?: string;
  ensureSchema?: boolean;
  sort?: {
    nextRunAt?: AgendaSortDirection;
    priority?: AgendaSortDirection;
  };
  disableNotifications?: boolean;
  logTableName?: string;
}

export interface RedisBackendConfig {
  connectionString?: string;
  redisOptions?: Record<string, unknown>;
  redis?: unknown;
  keyPrefix?: string;
  channelName?: string;
  sort?: {
    nextRunAt?: AgendaSortDirection;
    priority?: AgendaSortDirection;
  };
}

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
  useFactory?: (...args: unknown[]) => Promise<T> | T;
  inject?: FactoryProvider['inject'];
  extraProviders?: Provider[];
}
