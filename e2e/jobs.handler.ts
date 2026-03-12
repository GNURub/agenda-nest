import {
  AgendaQueue,
  Define,
  Every,
  InjectQueue,
  Now,
  OnJobComplete,
  OnJobFail,
  OnJobStart,
  OnJobSuccess,
  OnQueueError,
  OnQueueReady,
  Queue,
  Schedule,
} from '../lib';

@Queue('jobs')
export class JobsHandler {
  constructor(@InjectQueue('jobs') private readonly queue: AgendaQueue) {}

  handled: string[] = [];

  @Define('defined job')
  definedJob() {
    this.handled.push(this.definedJob.name);
  }

  @Every('1 second')
  every1Second() {
    this.handled.push(this.every1Second.name);
  }

  @Every({ name: 'test failure', interval: '1 second' })
  testFailure() {
    throw new Error('job failed');
  }

  @Schedule('Tomorrow at noon')
  tomorrowAtNoon() {
    this.handled.push(this.tomorrowAtNoon.name);
  }

  @Now()
  runNow() {
    this.handled.push(this.runNow.name);
  }

  @OnQueueReady()
  async onQueueReady() {
    this.handled.push(this.onQueueReady.name);
    await this.queue.now('defined job');
  }

  @OnJobStart()
  onJobStart() {
    this.handled.push(this.onJobStart.name);
  }

  @OnJobStart('every1Second')
  onTestJobStart() {
    this.handled.push(this.onTestJobStart.name);
  }

  @OnJobComplete('every1Second')
  onTestJobComplete() {
    this.handled.push(this.onTestJobComplete.name);
  }

  @OnJobSuccess('every1Second')
  onTestJobSuccess() {
    this.handled.push(this.onTestJobSuccess.name);
  }

  @OnJobFail('test failure')
  onJobFail(error: Error) {
    this.handled.push(this.onJobFail.name);
  }

  @OnQueueError()
  onQueueError(error: Error) {
    this.handled.push(this.onQueueError.name);
  }
}
