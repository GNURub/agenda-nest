import { loadAgendaModule } from '../loaders/agenda.loader';
import { agendaFactory } from './agenda.factory';
import { createAgendaBackend } from './backend.factory';

vi.mock('../loaders/agenda.loader', () => ({
    loadAgendaModule: vi.fn(),
}));

vi.mock('./backend.factory', () => ({
    createAgendaBackend: vi.fn(),
}));

const loadAgendaModuleMock = loadAgendaModule as any;
const createAgendaBackendMock = createAgendaBackend as any;

describe('agendaFactory', () => {
    beforeEach(() => {
        loadAgendaModuleMock.mockReset();
        createAgendaBackendMock.mockReset();
    });

    it('should create an agenda instance with merged runtime config', async () => {
        class FakeAgenda {
            constructor(readonly attrs: Record<string, unknown>) { }
        }

        const backend = { name: 'backend' } as any;

        loadAgendaModuleMock.mockResolvedValue({
            Agenda: FakeAgenda,
        } as any);
        createAgendaBackendMock.mockResolvedValue(backend);

        const agenda = await agendaFactory(
            'reports',
            {
                autoStart: false,
                name: 'ignored-by-namespace',
                namespace: 'reports-space',
                processEvery: '1 minute',
            } as any,
            {
                processEvery: '5 minutes',
                defaultConcurrency: 10,
                backend: {
                    type: 'mongo',
                    options: { address: 'mongodb://example.test/agenda' },
                },
            } as any,
        );

        expect(createAgendaBackendMock).toHaveBeenCalledWith(
            {
                type: 'mongo',
                options: { address: 'mongodb://example.test/agenda' },
            },
            expect.objectContaining({
                queueName: 'reports',
                namespace: 'reports-space',
                collectionName: 'reports-queue',
            }),
        );
        expect((agenda as any).attrs).toEqual({
            defaultConcurrency: 10,
            name: 'ignored-by-namespace',
            processEvery: '1 minute',
            backend,
        });
    });
});
