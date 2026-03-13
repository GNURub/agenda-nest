import { Injectable } from '@nestjs/common';
import type { Job } from 'agenda';
import { AgendaQueue, Define, InjectQueue, Queue } from '../lib';

@Injectable()
export class SimpleScheduleService {
  constructor(
    @InjectQueue('started') private readonly startedQueue: AgendaQueue,
    @InjectQueue('finished') private readonly finishedQueue: AgendaQueue,
  ) {}

  async schedule(params: {
    reqId?: string;
    startAt?: Date;
    endPlus24HoursAt?: Date;
  }) {
    const reqId = `${params.reqId || ''}`.trim();

    if (!reqId || !params.startAt || !params.endPlus24HoursAt) {
      return;
    }

    const now = new Date();

    await this.startedQueue.schedule(
      params.startAt.getTime() > now.getTime()
        ? params.startAt
        : addMinutes(now, 1),
      'start-job',
      { reqId },
    );

    await this.finishedQueue.schedule(
      params.endPlus24HoursAt.getTime() > now.getTime()
        ? params.endPlus24HoursAt
        : addMinutes(endOfDay(now), 1),
      'finish-job',
      { reqId },
    );
  }
}

@Queue('started')
@Injectable()
export class StartJobHandler {
  handled: string[] = [];

  reset() {
    this.handled.length = 0;
  }

  @Define('start-job')
  async handle(job: Job<{ reqId?: string }>) {
    const reqId = job.attrs.data?.reqId;

    if (!reqId) {
      return;
    }

    this.handled.push(reqId);
  }
}

@Queue('finished')
@Injectable()
export class FinishJobHandler {
  handled: string[] = [];

  reset() {
    this.handled.length = 0;
  }

  @Define('finish-job')
  async handle(job: Job<{ reqId?: string }>) {
    const reqId = job.attrs.data?.reqId;

    if (!reqId) {
      return;
    }

    this.handled.push(reqId);
  }
}

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

const endOfDay = (date: Date) => {
  const value = new Date(date);

  value.setUTCHours(23, 59, 59, 999);

  return value;
};
