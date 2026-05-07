import type {
  Agenda,
  AgendaEventName,
  Job,
  JobLogQuery,
  JobLogQueryResult,
  JobParameters,
  JobWithState,
  JobsQueryOptions,
  JobsResult,
  RemoveJobsOptions,
} from 'agenda';
import type { AgendaDefineOptions, AgendaSchedulerOptions } from './interfaces';
import {
  cloneWithPrototype,
  getQualifiedEventName,
  getQualifiedJobName,
  getUnqualifiedJobName,
} from './utils';

type Listener = (...args: unknown[]) => void;

type DrainOptions = Parameters<Agenda['drain']>[0];

type MutableJob<DATA = unknown> = Job<DATA> & {
  attrs: JobParameters<DATA>;
};

type DefineJob = <DATA = unknown>(
  name: string,
  processor:
    | ((job: Job<DATA>) => Promise<void>)
    | ((job: Job<DATA>, done: (error?: Error) => void) => void),
  options?: AgendaDefineOptions,
) => void;

type MaybeNames = string | string[];

type QueueRemoveOptions = RemoveJobsOptions & {
  name?: string;
  names?: string | string[];
  notName?: string;
  notNames?: string | string[];
};

const mapNames = (
  value: MaybeNames | undefined,
  mapper: (name: string) => string,
): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value.map(mapper) : [mapper(value)];
};

export class AgendaQueue {
  private readonly listenerWrappers = new Map<
    string,
    WeakMap<Listener, Listener>
  >();

  constructor(
    private readonly agenda: Agenda,
    private readonly namespace: string,
  ) {}

  get ready() {
    return this.agenda.ready;
  }

  getRawAgenda() {
    return this.agenda;
  }

  define<DATA = unknown>(
    name: string,
    processor:
      | ((job: Job<DATA>) => Promise<void>)
      | ((job: Job<DATA>, done: (error?: Error) => void) => void),
    options?: AgendaDefineOptions,
  ) {
    const define = this.agenda.define.bind(this.agenda) as unknown as DefineJob;

    define(this.qualifyJobName(name), processor, options);
    return this;
  }

  create<DATA = unknown>(name: string, data?: DATA) {
    return this.agenda.create(this.qualifyJobName(name), data as DATA);
  }

  every(
    interval: string | number,
    name: string,
    data?: unknown,
    options?: AgendaSchedulerOptions,
  ) {
    return this.agenda.every(
      interval,
      this.qualifyJobName(name),
      data,
      options,
    );
  }

  schedule(
    when: string | Date,
    name: string,
    data?: unknown,
    options?: Omit<
      AgendaSchedulerOptions,
      'timezone' | 'skipImmediate' | 'forkMode'
    >,
  ) {
    return this.agenda.schedule(when, this.qualifyJobName(name), data, options);
  }

  now<DATA = unknown>(name: string, data?: DATA) {
    return this.agenda.now(this.qualifyJobName(name), data as DATA);
  }

  async queryJobs(options?: JobsQueryOptions): Promise<JobsResult> {
    const result = await this.agenda.queryJobs(
      this.qualifyQueryOptions(options),
    );

    return {
      ...result,
      jobs: result.jobs.map((job) => this.normalizeQueriedJob(job)),
    };
  }

  cancel(options: QueueRemoveOptions) {
    return this.agenda.cancel(this.qualifyRemoveOptions(options));
  }

  async getLogs(query?: JobLogQuery): Promise<JobLogQueryResult> {
    const result = await this.agenda.getLogs(
      query && 'jobName' in query && typeof query.jobName === 'string'
        ? { ...query, jobName: this.qualifyJobName(query.jobName) }
        : query,
    );

    return {
      ...result,
      entries: result.entries.map((entry) => ({
        ...entry,
        jobName:
          typeof entry.jobName === 'string'
            ? getUnqualifiedJobName(this.namespace, entry.jobName)
            : entry.jobName,
      })),
    };
  }

  clearLogs(query?: JobLogQuery) {
    return this.agenda.clearLogs(
      query && 'jobName' in query && typeof query.jobName === 'string'
        ? { ...query, jobName: this.qualifyJobName(query.jobName) }
        : query,
    );
  }

  start() {
    return this.agenda.start();
  }

  stop(closeConnection?: boolean) {
    return this.agenda.stop(closeConnection);
  }

  drain(options?: DrainOptions) {
    return this.agenda.drain(options);
  }

  on(eventName: AgendaEventName | string, listener: Listener) {
    (
      this.agenda as unknown as {
        on(eventName: string, listener: Listener): Agenda;
      }
    ).on(
      this.qualifyEventName(String(eventName)),
      this.getWrappedListener(String(eventName), listener),
    );

    return this;
  }

  once(eventName: AgendaEventName | string, listener: Listener) {
    (
      this.agenda as unknown as {
        once(eventName: string, listener: Listener): Agenda;
      }
    ).once(
      this.qualifyEventName(String(eventName)),
      this.getWrappedListener(String(eventName), listener),
    );

    return this;
  }

  off(eventName: AgendaEventName | string, listener: Listener) {
    (
      this.agenda as unknown as {
        off(eventName: string, listener: Listener): Agenda;
      }
    ).off(
      this.qualifyEventName(String(eventName)),
      this.getRegisteredListener(String(eventName), listener),
    );
    return this;
  }

  removeListener(eventName: AgendaEventName | string, listener: Listener) {
    (
      this.agenda as unknown as {
        removeListener(eventName: string, listener: Listener): Agenda;
      }
    ).removeListener(
      this.qualifyEventName(String(eventName)),
      this.getRegisteredListener(String(eventName), listener),
    );
    return this;
  }

  private qualifyJobName(jobName: string) {
    return getQualifiedJobName(this.namespace, jobName);
  }

  private qualifyEventName(eventName: string) {
    return getQualifiedEventName(this.namespace, eventName);
  }

  private qualifyQueryOptions(options?: JobsQueryOptions) {
    if (!options) {
      return options;
    }

    return {
      ...options,
      name:
        typeof options.name === 'string'
          ? this.qualifyJobName(options.name)
          : options.name,
      names: options.names?.map((name) => this.qualifyJobName(name)),
    };
  }

  private qualifyRemoveOptions(options: QueueRemoveOptions): RemoveJobsOptions {
    const { name, names, notName, notNames, ...rest } = options;
    const qualifiedNames = [
      ...(mapNames(names, (name) => this.qualifyJobName(name)) || []),
      ...(name ? [this.qualifyJobName(name)] : []),
    ];

    const qualifiedNotNames = [
      ...(mapNames(notNames, (name) => this.qualifyJobName(name)) || []),
      ...(notName ? [this.qualifyJobName(notName)] : []),
    ];

    return {
      ...rest,
      names: qualifiedNames.length ? qualifiedNames : undefined,
      notNames: qualifiedNotNames.length ? qualifiedNotNames : undefined,
    };
  }

  private normalizeQueriedJob<T extends JobWithState>(job: T): T {
    return {
      ...job,
      name: getUnqualifiedJobName(this.namespace, job.name),
    };
  }

  private normalizeJob<T extends Job>(job: T): T {
    const clone = cloneWithPrototype(job) as MutableJob;

    clone.attrs = {
      ...clone.attrs,
      name: getUnqualifiedJobName(this.namespace, clone.attrs.name),
    };

    return clone as T;
  }

  private normalizeValue<T>(value: T): T {
    if (!value || typeof value !== 'object') {
      return value;
    }

    if ('attrs' in (value as Record<string, unknown>)) {
      return this.normalizeJob(value as T & Job) as unknown as T;
    }

    if ('jobName' in (value as Record<string, unknown>)) {
      return {
        ...(value as Record<string, unknown>),
        jobName: getUnqualifiedJobName(
          this.namespace,
          String((value as Record<string, unknown>).jobName),
        ),
      } as T;
    }

    return value;
  }

  private wrapListener(listener: Listener): Listener {
    return (...args: unknown[]) => {
      listener(...args.map((arg) => this.normalizeValue(arg)));
    };
  }

  private getWrappedListener(eventName: string, listener: Listener) {
    const qualifiedEventName = this.qualifyEventName(eventName);
    let listeners = this.listenerWrappers.get(qualifiedEventName);

    if (!listeners) {
      listeners = new WeakMap();
      this.listenerWrappers.set(qualifiedEventName, listeners);
    }

    const existing = listeners.get(listener);

    if (existing) {
      return existing;
    }

    const wrapped = this.wrapListener(listener);

    listeners.set(listener, wrapped);

    return wrapped;
  }

  private getRegisteredListener(eventName: string, listener: Listener) {
    return (
      this.listenerWrappers
        .get(this.qualifyEventName(eventName))
        ?.get(listener) || listener
    );
  }
}
