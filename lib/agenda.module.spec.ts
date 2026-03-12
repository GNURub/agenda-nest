import { AgendaModule } from './agenda.module';
import { AGENDA_MODULE_CONFIG } from './constants';
import { AgendaExplorer, AgendaMetadataAccessor } from './providers';
import { AgendaOrchestrator } from './providers/agenda.orchestrator';
import { getQueueConfigToken, getQueueToken, getRawQueueToken } from './utils';

describe('AgendaModule', () => {
  class RootConfigFactory {
    createAgendaConfig() {
      return {
        processEvery: '5 seconds',
        backend: {
          type: 'mongo' as const,
          options: { address: 'mongodb://example.test/agenda' },
        },
      };
    }
  }

  class QueueConfigFactory {
    createAgendaConfig() {
      return {
        autoStart: false,
        namespace: 'reports-space',
      };
    }
  }

  it('should register sync root providers', () => {
    const moduleRef = AgendaModule.forRoot({
      processEvery: 100,
      backend: {
        type: 'mongo',
        options: { address: 'mongodb://example.test/agenda' },
      },
    });

    expect(moduleRef.global).toBe(true);
    expect(moduleRef.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: AGENDA_MODULE_CONFIG }),
        AgendaMetadataAccessor,
        AgendaExplorer,
        AgendaOrchestrator,
      ]),
    );
  });

  it('should create async root providers from useClass', async () => {
    const moduleRef = AgendaModule.forRootAsync({
      useClass: RootConfigFactory,
    });
    const optionsProvider = (moduleRef.providers as any[]).find(
      (provider) => provider.provide === AGENDA_MODULE_CONFIG,
    );

    await expect(
      optionsProvider.useFactory(new RootConfigFactory()),
    ).resolves.toEqual({
      processEvery: '5 seconds',
      backend: {
        type: 'mongo',
        options: { address: 'mongodb://example.test/agenda' },
      },
    });
  });

  it('should create async root providers from useFactory', async () => {
    const moduleRef = AgendaModule.forRootAsync({
      inject: ['TOKEN'],
      useFactory: (token: string) => ({
        processEvery: token,
        backend: {
          type: 'mongo' as const,
          options: { address: 'mongodb://example.test/agenda' },
        },
      }),
    });
    const optionsProvider = (moduleRef.providers as any[]).find(
      (provider) => provider.provide === AGENDA_MODULE_CONFIG,
    );

    expect(optionsProvider.inject).toEqual(['TOKEN']);
    expect(optionsProvider.useFactory('every-second')).toEqual({
      processEvery: 'every-second',
      backend: {
        type: 'mongo',
        options: { address: 'mongodb://example.test/agenda' },
      },
    });
  });

  it('should create async queue providers from useExisting', async () => {
    const moduleRef = AgendaModule.registerQueueAsync('reports', {
      useExisting: QueueConfigFactory,
      extraProviders: [{ provide: 'EXTRA', useValue: true }],
    });
    const providers = moduleRef.providers as any[];
    const configProvider = providers.find(
      (provider) => provider.provide === getQueueConfigToken('reports'),
    );

    await expect(
      configProvider.useFactory(new QueueConfigFactory()),
    ).resolves.toEqual({ autoStart: false, namespace: 'reports-space' });
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: getRawQueueToken('reports') }),
        expect.objectContaining({ provide: getQueueToken('reports') }),
        expect.objectContaining({ provide: 'EXTRA', useValue: true }),
      ]),
    );
  });
});
