import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Every, OnJobFail, Queue } from '../decorators';
import { AgendaMetadataAccessor } from './agenda-metadata.accessor';
import { AgendaExplorer } from './agenda.explorer';
import { AgendaOrchestrator } from './agenda.orchestrator';

describe('AgendaExplorer', () => {
  @Queue('jobs')
  class JobsHandler {
    failures = 0;

    @Every('1 minute')
    sendDigest() {}

    @OnJobFail('sendDigest')
    onFailure() {
      this.failures += 1;
    }

    explode() {
      throw new Error('boom');
    }
  }

  it('should register queues, processors and listeners from discovered providers', () => {
    const handler = new JobsHandler();
    const discoveryService = {
      getProviders: vi.fn().mockReturnValue([
        {
          instance: handler,
          metatype: JobsHandler,
        },
      ]),
    } as unknown as DiscoveryService;
    const metadataScanner = new MetadataScanner();
    const metadataAccessor = new AgendaMetadataAccessor(new Reflector());
    const orchestrator = {
      addQueue: vi.fn(),
      addJobProcessor: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as AgendaOrchestrator;

    const explorer = new AgendaExplorer(
      discoveryService,
      metadataAccessor,
      metadataScanner,
      orchestrator,
    );

    explorer.onModuleInit();

    expect((discoveryService.getProviders as any).mock.calls).toHaveLength(1);
    expect((orchestrator.addQueue as any).mock.calls[0]).toEqual([
      'jobs',
      'jobs-queue:raw',
      'AgendaQueueOptions_jobs',
    ]);
    expect((orchestrator.addJobProcessor as any).mock.calls[0][1]._name).toBe(
      'sendDigest',
    );
    expect(
      (orchestrator.addEventListener as any).mock.calls[0].slice(2),
    ).toEqual(['fail', 'sendDigest']);
  });

  it('should wrap handlers and rethrow synchronous errors', () => {
    const discoveryService = {
      getProviders: vi.fn().mockReturnValue([]),
    } as unknown as DiscoveryService;
    const metadataScanner = new MetadataScanner();
    const metadataAccessor = new AgendaMetadataAccessor(new Reflector());
    const orchestrator = {
      addQueue: vi.fn(),
      addJobProcessor: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as AgendaOrchestrator;

    const explorer = new AgendaExplorer(
      discoveryService,
      metadataAccessor,
      metadataScanner,
      orchestrator,
    ) as any;

    const loggerSpy = vi
      .spyOn(explorer.logger, 'error')
      .mockImplementation(() => undefined);
    const handler = explorer.wrapFunctionInTryCatchBlocks(function explode() {
      throw new Error('boom');
    }, {});

    expect(() => handler()).toThrow('boom');
    expect(loggerSpy).toHaveBeenCalled();
    expect(handler._name).toBe('explode');
  });
});
