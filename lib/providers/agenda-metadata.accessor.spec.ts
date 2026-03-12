import { Reflector } from '@nestjs/core';
import { Every, OnJobFail, Queue } from '../decorators';
import { JobProcessorType } from '../enums';
import { AgendaMetadataAccessor } from './agenda-metadata.accessor';

describe('AgendaMetadataAccessor', () => {
  const accessor = new AgendaMetadataAccessor(new Reflector());

  @Queue('jobs')
  class JobsHandler {
    @Every('1 minute')
    sendDigest() {}

    @OnJobFail('sendDigest')
    onFailure() {}
  }

  it('should detect queue metadata', () => {
    expect(accessor.isQueue(JobsHandler)).toBe(true);
    expect(accessor.getQueueMetadata(JobsHandler)).toEqual({
      queueName: 'jobs',
    });
  });

  it('should detect job processors and listeners', () => {
    expect(accessor.isJobProcessor(JobsHandler.prototype.sendDigest)).toBe(
      true,
    );
    expect(accessor.getJobProcessorType(JobsHandler.prototype.sendDigest)).toBe(
      JobProcessorType.EVERY,
    );
    expect(
      accessor.getJobProcessorMetadata(JobsHandler.prototype.sendDigest),
    ).toEqual({ interval: '1 minute' });
    expect(accessor.isEventListener(JobsHandler.prototype.onFailure)).toBe(
      true,
    );
    expect(accessor.getJobName(JobsHandler.prototype.onFailure)).toBe(
      'sendDigest',
    );
  });
});
