import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Agenda, Job } from 'agenda';
import { NO_QUEUE_FOUND } from '../agenda.messages';
import type { AgendaQueueConfig } from '../interfaces';
import { getQueueConfigToken, getRawQueueToken } from '../utils';
import { AgendaMetadataAccessor } from './agenda-metadata.accessor';
import { AgendaOrchestrator } from './agenda.orchestrator';

type AgendaProcessor =
  | ((job: Job) => Promise<void>)
  | ((job: Job, done: (error?: Error) => void) => void);

@Injectable()
export class AgendaExplorer implements OnModuleInit {
  private readonly logger = new Logger('Agenda');

  constructor(
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService,
    @Inject(AgendaMetadataAccessor)
    private readonly metadataAccessor: AgendaMetadataAccessor,
    @Inject(MetadataScanner)
    private readonly metadataScanner: MetadataScanner,
    @Inject(AgendaOrchestrator)
    private readonly orchestrator: AgendaOrchestrator,
  ) {}

  onModuleInit() {
    this.explore();
  }

  private explore() {
    const providers = this.discoveryService.getProviders();

    providers
      .filter((wrapper: InstanceWrapper) => {
        return this.metadataAccessor.isQueue(
          !wrapper.metatype || wrapper.inject
            ? wrapper?.constructor
            : wrapper.metatype,
        );
      })
      .forEach((wrapper: InstanceWrapper) => {
        const { instance, metatype } = wrapper;

        const { queueName } = this.metadataAccessor.getQueueMetadata(
          instance.constructor || metatype,
        );

        const queueToken = getRawQueueToken(queueName);

        const queueConfigToken = getQueueConfigToken(queueName);

        const queue = this.getProviderInstance<Agenda>(providers, queueToken);

        const queueConfig = this.getProviderInstance<AgendaQueueConfig>(
          providers,
          queueConfigToken,
        );

        this.orchestrator.addQueue(queueName, queueToken, queue, queueConfig);

        this.metadataScanner.scanFromPrototype(
          instance,
          Object.getPrototypeOf(instance),
          (key: string) => {
            const methodRef = instance[key];

            if (this.metadataAccessor.isJobProcessor(methodRef)) {
              const jobProcessorType =
                this.metadataAccessor.getJobProcessorType(methodRef);

              const jobOptions =
                this.metadataAccessor.getJobProcessorMetadata(methodRef);

              const jobProcessor: AgendaProcessor & Record<'_name', string> =
                this.wrapFunctionInTryCatchBlocks(methodRef, instance);

              this.orchestrator.addJobProcessor(
                queueToken,
                jobProcessor,
                jobOptions,
                jobProcessorType,
                methodRef.length === 2,
              );
            } else if (this.metadataAccessor.isEventListener(methodRef)) {
              const listener = this.wrapFunctionInTryCatchBlocks(
                methodRef,
                instance,
              );

              const eventName =
                this.metadataAccessor.getListenerMetadata(methodRef);

              const jobName = this.metadataAccessor.getJobName(methodRef);

              return this.orchestrator.addEventListener(
                queueToken,
                listener,
                eventName,
                jobName,
              );
            }
          },
        );
      });
  }

  private getProviderInstance<T>(
    providers: InstanceWrapper[],
    token: string,
  ): T {
    const provider = providers.find((wrapper) => wrapper.token === token);

    if (!provider?.instance) {
      this.logger.error(NO_QUEUE_FOUND(token));
      throw new Error(`Provider not found for token ${token}`);
    }

    return provider.instance as T;
  }

  private wrapFunctionInTryCatchBlocks(methodRef: Function, instance: object) {
    const handler = (...args: unknown[]) => {
      try {
        return methodRef.call(instance, ...args);
      } catch (error) {
        this.logger.error(error);
        throw error;
      }
    };

    handler._name = methodRef.name;

    return handler;
  }
}
