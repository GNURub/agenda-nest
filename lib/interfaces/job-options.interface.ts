import type { BackoffStrategy, JobDefinition } from 'agenda';

export type JobPriority =
  | 'lowest'
  | 'low'
  | 'normal'
  | 'high'
  | 'highest'
  | number;

export type AgendaDefineOptions = Partial<
  Pick<
    JobDefinition,
    | 'lockLimit'
    | 'lockLifetime'
    | 'concurrency'
    | 'backoff'
    | 'removeOnComplete'
    | 'logging'
  >
> & {
  priority?: JobPriority;
  backoff?: BackoffStrategy;
};

export type AgendaSchedulerOptions = {
  timezone?: string;
  skipImmediate?: boolean;
  forkMode?: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  skipDays?: number[];
};

export type JobOptions = AgendaDefineOptions &
  AgendaSchedulerOptions & {
    name?: string;
  };
