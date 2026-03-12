import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Agenda, Job } from 'agenda';
import { NO_QUEUE_FOUND } from '../agenda.messages';
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

type JobProcessorConfig = {
  handler: AgendaProcessor;
  type: JobProcessorType;
  options: RepeatableJobOptions | NonRepeatableJobOptions;
  useCallback: boolean;
};

export type EventListener = (...args: any[]) => void;

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
  implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger('Agenda');

  private readonly queues: Map<string, QueueRegistry> = new Map();

  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

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
    for await (const queue of this.queues) {
      const [, config] = queue;

      await config.queue.stop();
    }
  }

  addQueue(queueName: string, queueToken: string, queueConfigToken: string) {
    const queue = this.getQueue(queueName, queueToken);
    const config = this.getQueueConfig(queueConfigToken);
    const namespace = getQueueNamespace(queueName, config.namespace);

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
        agenda.ready.then(() => listener());
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

        if (useCallback) {
          (agenda as any).define(
            qualifiedJobName,
            (job: Job, done: () => void) => handler(job, done),
            options,
          );
        } else {
          (agenda as any).define(qualifiedJobName, handler, options);
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

  private getQueue(queueName: string, queueToken: string): Agenda {
    try {
      return this.moduleRef.get<Agenda>(queueToken, { strict: false });
    } catch (error) {
      this.logger.error(NO_QUEUE_FOUND(queueName));
      throw error;
    }
  }

  private getQueueConfig(queueConfigToken: string): AgendaQueueConfig {
    return this.moduleRef.get<AgendaQueueConfig>(queueConfigToken, {
      strict: false,
    });
  }
}
