import { Now, Queue } from '../lib';

@Queue('alpha')
export class AlphaJobsHandler {
  handled: string[] = [];

  @Now('shared job')
  sharedJob() {
    this.handled.push(this.sharedJob.name);
  }
}

@Queue('beta')
export class BetaJobsHandler {
  handled: string[] = [];

  @Now('shared job')
  sharedJob() {
    this.handled.push(this.sharedJob.name);
  }
}
