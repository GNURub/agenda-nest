import type { BackoffStrategy, JobDefinition } from 'agenda';

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
  priority?: string | number;
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
