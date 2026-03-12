import { Injectable } from '@nestjs/common';
import type { Job } from 'agenda';
import { AgendaQueue, Define, InjectQueue, OnJobSuccess, Queue } from '../lib';

export type EmailPayload = {
  to: string;
  nested: {
    attempt: number;
  };
};

@Queue('jobs')
@Injectable()
export class MongoJobsHandler {
  constructor(@InjectQueue('jobs') private readonly queue: AgendaQueue) {}

  readonly processedJobs: Array<Record<string, unknown>> = [];

  readonly successEvents: Array<Record<string, unknown>> = [];

  reset() {
    this.processedJobs.length = 0;
    this.successEvents.length = 0;
  }

  @Define('send-email')
  async sendEmail(job: Job<EmailPayload>) {
    this.processedJobs.push({
      name: job.attrs.name,
      data: job.attrs.data,
      failCount: job.attrs.failCount,
    });
  }

  @OnJobSuccess('send-email')
  onJobSuccess(job: Job<EmailPayload>) {
    this.successEvents.push({
      name: job.attrs.name,
      data: job.attrs.data,
      failCount: job.attrs.failCount,
    });
  }

  async scheduleInFuture(payload: EmailPayload, when: Date) {
    return this.queue.schedule(when, 'send-email', payload);
  }

  async runNow(payload: EmailPayload) {
    return this.queue.now('send-email', payload);
  }
}
