import { Inject, Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AGENDA_JOB_OPTIONS,
  AGENDA_MODULE_QUEUE,
  JOB_NAME,
  JOB_PROCESSOR_TYPE,
  ON_QUEUE_EVENT,
} from '../constants';
import { AgendaModuleJobOptions, QueueDecoratorConfig } from '../decorators';
import { AgendaQueueEvent, JobProcessorType } from '../enums';

@Injectable()
export class AgendaMetadataAccessor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  isQueue(target: Type<unknown> | Function): boolean {
    return !!this.reflector.get(AGENDA_MODULE_QUEUE, target);
  }

  isEventListener(target: Type<unknown> | Function): boolean {
    return !!this.getListenerMetadata(target);
  }

  isJobProcessor(target: Type<unknown> | Function): boolean {
    return !!this.getJobProcessorMetadata(target);
  }

  getListenerMetadata(
    target: Type<unknown> | Function,
  ): AgendaQueueEvent | undefined {
    return this.reflector.get(ON_QUEUE_EVENT, target);
  }

  getQueueMetadata(
    target: Type<unknown> | Function,
  ): QueueDecoratorConfig | undefined {
    return this.reflector.get(AGENDA_MODULE_QUEUE, target);
  }

  getJobProcessorType(target: Function): JobProcessorType {
    return this.reflector.get(JOB_PROCESSOR_TYPE, target);
  }

  getJobName(target: Function): string | undefined {
    return this.reflector.get(JOB_NAME, target);
  }

  getJobProcessorMetadata(
    target: Type<unknown> | Function,
  ): AgendaModuleJobOptions | undefined {
    return this.reflector.get(AGENDA_JOB_OPTIONS, target);
  }
}
