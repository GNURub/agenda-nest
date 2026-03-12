import { Test, TestingModule } from '@nestjs/testing';
import type { Agenda } from 'agenda';
import { AgendaModule } from '../lib';
import { AlphaJobsHandler, BetaJobsHandler } from './isolation.handlers';
import { JobsHandler } from './jobs.handler';

jest.setTimeout(10000);

type Listener = (...args: any[]) => void;

type FakeJob = {
  attrs: {
    name: string;
    data?: unknown;
  };
};

class FakeMongoBackend {
  static instances: FakeMongoBackend[] = [];

  readonly name = 'MongoDB';

  readonly repository = {} as any;

  readonly ownsConnection = true;

  constructor(readonly config: Record<string, unknown>) {
    FakeMongoBackend.instances.push(this);
  }

  async connect() {}

  async disconnect() {}
}

class FakeAgenda {
  readonly ready = Promise.resolve();

  readonly attrs: Record<string, unknown>;

  readonly backend: FakeMongoBackend;

  private readonly definitions = new Map<
    string,
    { processor: Function; options?: Record<string, unknown> }
  >();

  private readonly listeners = new Map<string, Listener[]>();

  private readonly pendingEvery: Array<{ name: string; data?: unknown }> = [];

  private readonly pendingNow: Array<{ name: string; data?: unknown }> = [];

  private started = false;

  constructor(config: Record<string, unknown>) {
    this.attrs = config;
    this.backend = config.backend as FakeMongoBackend;
  }

  on(eventName: string, listener: Listener) {
    this.listeners.set(eventName, [
      ...(this.listeners.get(eventName) || []),
      listener,
    ]);
    return this;
  }

  once(eventName: string, listener: Listener) {
    const onceListener: Listener = (...args) => {
      this.off(eventName, onceListener);
      listener(...args);
    };

    return this.on(eventName, onceListener);
  }

  off(eventName: string, listener: Listener) {
    this.listeners.set(
      eventName,
      (this.listeners.get(eventName) || []).filter(
        (current) => current !== listener,
      ),
    );
    return this;
  }

  removeListener(eventName: string, listener: Listener) {
    return this.off(eventName, listener);
  }

  define(name: string, processor: Function, options?: Record<string, unknown>) {
    this.definitions.set(name, { processor, options });
  }

  async every(_interval: string | number, name: string, data?: unknown) {
    this.pendingEvery.push({ name, data });

    if (this.started) {
      await this.executeJob(name, data);
    }

    return { attrs: { name, data } };
  }

  async schedule(_when: string | Date, name: string, data?: unknown) {
    return { attrs: { name, data } };
  }

  async now(name: string, data?: unknown) {
    if (this.started) {
      await this.executeJob(name, data);
    } else {
      this.pendingNow.push({ name, data });
    }

    return { attrs: { name, data } };
  }

  async start() {
    this.started = true;

    for (const job of this.pendingEvery) {
      await this.executeJob(job.name, job.data);
    }

    for (const job of this.pendingNow.splice(0)) {
      await this.executeJob(job.name, job.data);
    }
  }

  async stop() {}

  private emit(eventName: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(eventName) || []) {
      listener(...args);
    }
  }

  private async executeJob(name: string, data?: unknown) {
    const definition = this.definitions.get(name);

    if (!definition) {
      throw new Error(`Undefined job ${name}`);
    }

    const job: FakeJob = {
      attrs: {
        name,
        data,
      },
    };

    this.emit('start', job);
    this.emit(`start:${name}`, job);

    try {
      if (definition.processor.length >= 2) {
        await new Promise<void>((resolve, reject) => {
          definition.processor(job, (error?: Error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      } else {
        await definition.processor(job);
      }

      this.emit('success', job);
      this.emit(`success:${name}`, job);
    } catch (error) {
      this.emit('fail', error, job);
      this.emit(`fail:${name}`, error, job);
    } finally {
      this.emit('complete', job);
      this.emit(`complete:${name}`, job);
    }
  }
}

jest.mock('../lib/loaders/agenda.loader', () => ({
  loadAgendaModule: async () => ({ Agenda: FakeAgenda }),
  loadMongoBackendModule: async () => ({ MongoBackend: FakeMongoBackend }),
  loadPostgresBackendModule: async () => ({
    PostgresBackend: class UnsupportedPostgresBackend {
      constructor() {
        throw new Error('Postgres backend is not used in these tests');
      }
    },
  }),
  loadRedisBackendModule: async () => ({
    RedisBackend: class UnsupportedRedisBackend {
      constructor() {
        throw new Error('Redis backend is not used in these tests');
      }
    },
  }),
}));

const wait = (interval = 0) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), interval);
  });

const getRootModule = () =>
  AgendaModule.forRoot({
    processEvery: 100,
    backend: {
      type: 'mongo',
      options: {
        address: 'mongodb://example.test/agenda',
        ensureIndex: false,
      },
    },
  });

describe('Agenda Module', () => {
  beforeEach(() => {
    FakeMongoBackend.instances = [];
  });

  describe('handles decorators', () => {
    let testingModule: TestingModule;
    let jobsHandler: JobsHandler;
    let agenda: Agenda;

    beforeAll(async () => {
      testingModule = await Test.createTestingModule({
        imports: [getRootModule(), AgendaModule.registerQueue('jobs')],
        providers: [JobsHandler],
      }).compile();

      jobsHandler = testingModule.get(JobsHandler);
      agenda = testingModule.get<Agenda>('jobs-queue:raw', { strict: false });

      await testingModule.init();
      await (agenda as any).ready;
      await wait();
    });

    afterAll(async () => {
      await testingModule.close();
    });

    it('should allow scheduling a defined job through InjectQueue facade', () => {
      expect(jobsHandler.handled).toContain('definedJob');
    });

    it('should schedule a job to run at the given interval', () => {
      expect(jobsHandler.handled).toContain('every1Second');
    });

    it('should run handle jobs scheduled to run immediately', () => {
      expect(jobsHandler.handled).toContain('runNow');
    });

    it('should notify when the queue is ready', () => {
      expect(jobsHandler.handled).toContain('onQueueReady');
    });

    it('should notify when any job has started', () => {
      expect(jobsHandler.handled).toContain('onJobStart');
    });

    it('should notify when a specific job has started', () => {
      expect(jobsHandler.handled).toContain('onTestJobStart');
    });

    it('should notify when a specifc job has completed', () => {
      expect(jobsHandler.handled).toContain('onTestJobComplete');
    });

    it('should notify when a job has completed', () => {
      expect(jobsHandler.handled).toContain('onTestJobSuccess');
    });

    it('should notify when a job has failed', () => {
      expect(jobsHandler.handled).toContain('onJobFail');
    });
  });

  describe('configuration', () => {
    it('should auto start the queue', async () => {
      const testingModule = await Test.createTestingModule({
        imports: [getRootModule(), AgendaModule.registerQueue('jobs')],
        providers: [JobsHandler],
      }).compile();

      const agenda = testingModule.get<Agenda>('jobs-queue:raw', {
        strict: false,
      });
      jest.spyOn(agenda, 'start');

      await testingModule.init();

      expect(agenda.start).toHaveBeenCalled();

      await testingModule.close();
    });

    it('should not auto start the queue', async () => {
      const testingModule = await Test.createTestingModule({
        imports: [
          getRootModule(),
          AgendaModule.registerQueue('jobs', { autoStart: false }),
        ],
        providers: [JobsHandler],
      }).compile();

      const agenda = testingModule.get<Agenda>('jobs-queue:raw', {
        strict: false,
      });
      jest.spyOn(agenda, 'start');

      await testingModule.init();

      expect(agenda.start).not.toHaveBeenCalled();

      await testingModule.close();
    });

    it('should pass custom collection name to the backend', async () => {
      const testingModule = await Test.createTestingModule({
        imports: [
          getRootModule(),
          AgendaModule.registerQueue('jobs', { collection: 'galactus' }),
        ],
        providers: [JobsHandler],
      }).compile();

      await testingModule.init();

      const agenda = testingModule.get<any>('jobs-queue:raw', {
        strict: false,
      });

      expect(agenda.backend.config.collection).toBe('galactus');

      await testingModule.close();
    });
  });

  describe('queue isolation', () => {
    it('should isolate queues with identical job names', async () => {
      const testingModule = await Test.createTestingModule({
        imports: [
          getRootModule(),
          AgendaModule.registerQueue('alpha'),
          AgendaModule.registerQueue('beta'),
        ],
        providers: [AlphaJobsHandler, BetaJobsHandler],
      }).compile();

      await testingModule.init();
      await wait();

      const alpha = testingModule.get(AlphaJobsHandler);
      const beta = testingModule.get(BetaJobsHandler);

      expect(alpha.handled).toContain('sharedJob');
      expect(beta.handled).toContain('sharedJob');

      await testingModule.close();
    });
  });
});
