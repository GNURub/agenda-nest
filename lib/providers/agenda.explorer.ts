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

type HandlerFunction = ((...args: unknown[]) => unknown) & {
  readonly length: number;
  readonly name: string;
};

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

        const queueMetadata = this.metadataAccessor.getQueueMetadata(
          instance.constructor || metatype,
        );
        const queueName = queueMetadata?.queueName;

        const queueToken = getRawQueueToken(queueName);

        const queueConfigToken = getQueueConfigToken(queueName);

        const queue = this.getProviderInstance<Agenda>(providers, queueToken);

        const queueConfig = this.getProviderInstance<AgendaQueueConfig>(
          providers,
          queueConfigToken,
        );

        this.orchestrator.addQueue(queueName, queueToken, queue, queueConfig);

        for (const key of this.metadataScanner.getAllMethodNames(
          Object.getPrototypeOf(instance),
        )) {
          const methodRef = instance[key] as HandlerFunction;

          if (this.metadataAccessor.isJobProcessor(methodRef)) {
            const jobProcessorType =
              this.metadataAccessor.getJobProcessorType(methodRef);

            const jobOptions =
              this.metadataAccessor.getJobProcessorMetadata(methodRef);

            if (!jobOptions) {
              continue;
            }

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
            if (!eventName) {
              continue;
            }

            const jobName = this.metadataAccessor.getJobName(methodRef);

            this.orchestrator.addEventListener(
              queueToken,
              listener,
              eventName,
              jobName,
            );
          }
        }
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

  private wrapFunctionInTryCatchBlocks(
    methodRef: HandlerFunction,
    instance: object,
  ) {
    const handler: HandlerFunction & Record<'_name', string> = (
      ...args: unknown[]
    ) => {
      return methodRef.call(instance, ...args);
    };

    handler._name = methodRef.name;

    return handler;
  }
}
