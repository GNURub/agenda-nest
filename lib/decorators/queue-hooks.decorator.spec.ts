import { Reflector } from '@nestjs/core';
import { JOB_NAME, ON_QUEUE_EVENT } from '../constants';
import { AgendaQueueEvent } from '../enums';
import {
  OnJobComplete,
  OnJobFail,
  OnJobStart,
  OnJobSuccess,
  OnQueueError,
  OnQueueReady,
} from './queue-hooks.decorator';

describe('queue hooks decorators', () => {
  const reflector = new Reflector();

  class ExampleHandler {
    @OnQueueReady()
    onReady() {}

    @OnQueueError()
    onError() {}

    @OnJobStart('sendEmail')
    onStart() {}

    @OnJobComplete('sendEmail')
    onComplete() {}

    @OnJobSuccess('sendEmail')
    onSuccess() {}

    @OnJobFail('sendEmail')
    onFail() {}
  }

  it('should define metadata for queue-level events', () => {
    expect(
      reflector.get(ON_QUEUE_EVENT, ExampleHandler.prototype.onReady),
    ).toBe(AgendaQueueEvent.READY);
    expect(
      reflector.get(ON_QUEUE_EVENT, ExampleHandler.prototype.onError),
    ).toBe(AgendaQueueEvent.ERROR);
  });

  it('should define metadata for job-level events', () => {
    expect(
      reflector.get(ON_QUEUE_EVENT, ExampleHandler.prototype.onStart),
    ).toBe(AgendaQueueEvent.START);
    expect(reflector.get(JOB_NAME, ExampleHandler.prototype.onStart)).toBe(
      'sendEmail',
    );
    expect(
      reflector.get(ON_QUEUE_EVENT, ExampleHandler.prototype.onComplete),
    ).toBe(AgendaQueueEvent.COMPLETE);
    expect(
      reflector.get(ON_QUEUE_EVENT, ExampleHandler.prototype.onSuccess),
    ).toBe(AgendaQueueEvent.SUCCESS);
    expect(reflector.get(ON_QUEUE_EVENT, ExampleHandler.prototype.onFail)).toBe(
      AgendaQueueEvent.FAIL,
    );
  });
});
