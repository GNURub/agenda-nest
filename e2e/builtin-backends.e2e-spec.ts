import { AgendaQueue } from '../lib/agenda.queue';
import { agendaFactory } from '../lib/factories';
import type {
  AgendaBackendDefinition,
  AgendaModuleConfig,
} from '../lib/interfaces';

type BackendCase = {
  definition: AgendaBackendDefinition;
  name: string;
};

const backendCases: BackendCase[] = [];

if (process.env.POSTGRES_TEST_URL) {
  backendCases.push({
    name: 'postgres',
    definition: {
      type: 'postgres',
      options: {
        connectionString: process.env.POSTGRES_TEST_URL,
        tableName: 'agenda_nest_integration_jobs',
      },
    },
  });
}

if (process.env.REDIS_TEST_URL) {
  backendCases.push({
    name: 'redis',
    definition: {
      type: 'redis',
      options: {
        connectionString: process.env.REDIS_TEST_URL,
        keyPrefix: 'agenda-nest-integration:',
      },
    },
  });
}

if (backendCases.length === 0) {
  describe.skip('built-in backend integrations', () => {
    it('requires POSTGRES_TEST_URL or REDIS_TEST_URL', () => undefined);
  });
}

describe.each(backendCases)('$name backend', ({ definition, name }) => {
  it('should create, execute and stop a namespaced queue', async () => {
    const queueName = `${name}-integration`;
    const rootConfig: AgendaModuleConfig = {
      processEvery: 20,
      backend: definition,
    };
    const agenda = await agendaFactory(
      queueName,
      { autoStart: false },
      rootConfig,
    );
    const queue = new AgendaQueue(agenda, queueName);
    const handled = new Promise<{ value: string }>((resolve) => {
      queue.define<{ value: string }>('smoke', async (job) => {
        resolve(job.attrs.data);
      });
    });

    try {
      await queue.start();
      await queue.now('smoke', { value: name });

      await expect(handled).resolves.toEqual({ value: name });
    } finally {
      await queue.stop(true);
    }
  });
});
