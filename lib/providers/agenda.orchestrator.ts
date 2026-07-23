import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { Agenda, Job } from 'agenda';
import {
  AgendaModuleJobOptions,
  NonRepeatableJobOptions,
  RepeatableJobOptions,
} from '../decorators';
import { JobProcessorType } from '../enums';
import { AgendaQueueConfig } from '../interfaces';
import {
  getQualifiedEventName,
  getQualifiedJobName,
  getQueueNamespace,
} from '../utils';

type AgendaProcessor =
  | ((job: Job) => Promise<void>)
  | ((job: Job, done: (error?: Error) => void) => void);

type DefineJob = (
  name: string,
  processor: AgendaProcessor,
  options?: RepeatableJobOptions | NonRepeatableJobOptions,
) => void;

type JobProcessorConfig = {
  handler: AgendaProcessor;
  type: JobProcessorType;
  options: RepeatableJobOptions | NonRepeatableJobOptions;
  useCallback: boolean;
};

export type EventListener = (...args: unknown[]) => void;

type EventListenerConfig = {
  listener: EventListener;
  eventName: string;
  jobName?: string;
};

type QueueRegistry = {
  config: AgendaQueueConfig;
  processors: Map<string, JobProcessorConfig>;
  listeners: EventListenerConfig[];
  queue: Agenda;
  namespace: string;
};

@Injectable()
export class AgendaOrchestrator
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger('Agenda');

  private readonly queues: Map<string, QueueRegistry> = new Map();

  async onApplicationBootstrap() {
    for await (const queue_ of this.queues) {
      const [, registry] = queue_;

      const { config, queue } = registry;

      this.defineJobProcessors(queue, registry);
      await this.scheduleJobs(queue, registry);

      this.attachEventListeners(queue, registry);

      if (config.autoStart !== false) {
        await queue.start();
      }
    }
  }

  async beforeApplicationShutdown() {
    const results = await Promise.allSettled(
      [...this.queues.values()].map(({ queue }) => queue.stop()),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (failure) {
      throw failure.reason;
    }
  }

  addQueue(
    queueName: string | undefined,
    queueToken: string,
    queue: Agenda,
    config: AgendaQueueConfig,
  ) {
    const namespace = getQueueNamespace(queueName, config.namespace);
    const existing = this.queues.get(queueToken);

    if (existing) {
      existing.queue = queue;
      existing.config = config;
      existing.namespace = namespace;
      return;
    }

    this.queues.set(queueToken, {
      queue,
      config,
      namespace,
      processors: new Map(),
      listeners: [],
    });
  }

  addJobProcessor(
    queueToken: string,
    processor: AgendaProcessor & Record<'_name', string>,
    options: AgendaModuleJobOptions,
    type: JobProcessorType,
    useCallback: boolean,
  ) {
    const jobName = options.name || processor._name;

    this.queues.get(queueToken)?.processors.set(jobName, {
      handler: processor,
      useCallback,
      type,
      options,
    });
  }

  addEventListener(
    queueToken: string,
    listener: EventListener,
    eventName: string,
    jobName?: string,
  ) {
    this.queues.get(queueToken)?.listeners.push({
      listener,
      eventName,
      jobName,
    });
  }

  private attachEventListeners(agenda: Agenda, registry: QueueRegistry) {
    registry.listeners.forEach(({ listener, eventName, jobName }) => {
      if (eventName === 'ready') {
        agenda.ready
          .then(() => listener())
          .catch((error: unknown) => {
            this.logger.error('Agenda ready listener failed', error);
          });
        return;
      }

      const qualifiedEventName = jobName
        ? getQualifiedEventName(registry.namespace, `${eventName}:${jobName}`)
        : eventName;

      (
        agenda as unknown as {
          on(eventName: string, listener: EventListener): Agenda;
        }
      ).on(qualifiedEventName, listener);
    });
  }

  private defineJobProcessors(agenda: Agenda, registry: QueueRegistry) {
    registry.processors.forEach(
      (jobConfig: JobProcessorConfig, jobName: string) => {
        const { options, handler, useCallback } = jobConfig;
        const qualifiedJobName = getQualifiedJobName(
          registry.namespace,
          jobName,
        );
        const define = agenda.define.bind(agenda) as unknown as DefineJob;

        if (useCallback) {
          define(
            qualifiedJobName,
            (job: Job, done: (error?: Error) => void) => handler(job, done),
            options,
          );
        } else {
          define(qualifiedJobName, handler, options);
        }
      },
    );
  }

  private async scheduleJobs(agenda: Agenda, registry: QueueRegistry) {
    for await (const processor of registry.processors) {
      const [jobName, jobConfig] = processor;

      const { type, options } = jobConfig;
      const qualifiedJobName = getQualifiedJobName(registry.namespace, jobName);

      if (type === JobProcessorType.EVERY) {
        await agenda.every(
          (options as RepeatableJobOptions).interval,
          qualifiedJobName,
          {},
          options,
        );
      } else if (type === JobProcessorType.SCHEDULE) {
        await agenda.schedule(
          (options as NonRepeatableJobOptions).when,
          qualifiedJobName,
          {},
          options,
        );
      } else if (type === JobProcessorType.NOW) {
        await agenda.now(qualifiedJobName, {});
      }
    }
  }
}
