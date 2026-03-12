import { applyDecorators, SetMetadata } from '@nestjs/common';
import { AGENDA_JOB_OPTIONS, JOB_PROCESSOR_TYPE } from '../constants';
import { JobProcessorType } from '../enums';
import { AgendaDefineOptions } from '../interfaces';

type NameAndDefineOptions = AgendaDefineOptions & Record<'name', string>;

export function Define(name?: string): MethodDecorator;
export function Define(options?: NameAndDefineOptions): MethodDecorator;
export function Define(
  nameOrOptions?: string | NameAndDefineOptions,
): MethodDecorator {
  let options = {};

  if (nameOrOptions) {
    options =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions }
        : nameOrOptions;
  }

  return applyDecorators(
    SetMetadata(AGENDA_JOB_OPTIONS, options),
    SetMetadata(JOB_PROCESSOR_TYPE, JobProcessorType.DEFINE),
  );
}
