import { SetMetadata, Type } from '@nestjs/common';
import { AgendaQueueConfig } from '../interfaces';
import { AGENDA_MODULE_QUEUE } from '../constants';

export type QueueDecoratorConfig = AgendaQueueConfig & {
  queueName?: string;
};

export function Queue(): ClassDecorator;
export function Queue(name: string): ClassDecorator;
export function Queue(config: QueueDecoratorConfig): ClassDecorator;
export function Queue(
  nameOrConfig?: string | QueueDecoratorConfig,
): ClassDecorator {
  const agendaConfig = nameOrConfig
    ? typeof nameOrConfig === 'string'
      ? { queueName: nameOrConfig }
      : nameOrConfig
    : {};

  return (target: Type<unknown> | Function) => {
    SetMetadata(AGENDA_MODULE_QUEUE, agendaConfig)(target);
  };
}
