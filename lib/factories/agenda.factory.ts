import type { Agenda } from 'agenda';
import type { AgendaModuleConfig, AgendaQueueConfig } from '../interfaces';
import { loadAgendaModule } from '../loaders/agenda.loader';
import { getQueueCollectionName, getQueueNamespace } from '../utils';
import { createAgendaBackend } from './backend.factory';

export function agendaFactory(
  queueName: string | undefined,
  queueConfig: AgendaQueueConfig,
  rootConfig: AgendaModuleConfig,
): Promise<Agenda> {
  const agendaConfig = {
    ...rootConfig,
    ...queueConfig,
  };

  const namespace = getQueueNamespace(queueName, queueConfig.namespace);
  const collectionName = getQueueCollectionName(
    queueName,
    queueConfig.collection,
  );
  const backendDefinition = queueConfig.backend || rootConfig.backend;
  const runtimeConfig = Object.fromEntries(
    Object.entries(agendaConfig).filter(
      ([key]) =>
        !['backend', 'autoStart', 'collection', 'namespace'].includes(key),
    ),
  ) as Omit<
    AgendaModuleConfig & AgendaQueueConfig,
    'backend' | 'autoStart' | 'collection' | 'namespace'
  >;

  return loadAgendaModule().then(async ({ Agenda }) => {
    const backend = await createAgendaBackend(backendDefinition, {
      queueName,
      namespace,
      collectionName,
      rootConfig,
      queueConfig,
    });

    return new Agenda({
      ...runtimeConfig,
      name: runtimeConfig.name || namespace,
      backend,
    });
  });
}
