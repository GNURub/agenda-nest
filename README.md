# Agenda Nest

<p>
  <a href="https://www.npmjs.com/package/@gnurub/agenda-nest" target="_blank"><img src="https://img.shields.io/npm/v/@gnurub/agenda-nest.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@gnurub/agenda-nest" target="_blank"><img src="https://img.shields.io/npm/l/@gnurub/agenda-nest.svg" alt="Package License" /></a>
</p>

> Note: This repository is a fork of [jongolden/agenda-nest](https://github.com/jongolden/agenda-nest).

NestJS integration for Agenda v6 with queue registration, decorators, scoped queue facades, and multi-queue job namespacing.

Agenda Nest brings Agenda into the NestJS module system with:

- explicit Agenda v6 backend configuration
- queue registration through `AgendaModule`
- decorators for processors, schedulers, and queue events
- `@InjectQueue()` support via the `AgendaQueue` facade
- automatic queue namespacing so multiple queues can reuse the same job names safely
- payload integrity: only queue prefixes are normalized, while `job.attrs.data` and the rest of the job attributes remain intact

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Root Configuration](#root-configuration)
- [Queue Configuration](#queue-configuration)
- [Defining Job Processors](#defining-job-processors)
- [Scheduling Jobs](#scheduling-jobs)
- [Listening to Queue Events](#listening-to-queue-events)
- [Working with Queues Manually](#working-with-queues-manually)
- [Testing](#testing)
- [Migration Notes](#migration-notes)
- [License](#license)

## Installation

Agenda v6 uses explicit backends. Install Agenda Nest, Agenda itself, and the backend you want to use.

MongoDB:

```bash
npm install @gnurub/agenda-nest agenda @agendajs/mongo-backend
```

PostgreSQL:

```bash
npm install @gnurub/agenda-nest agenda @agendajs/postgres-backend
```

Redis:

```bash
npm install @gnurub/agenda-nest agenda @agendajs/redis-backend
```

Requirements:

- Node.js 24+
- NestJS >= 11
- Agenda 6.x

## Quick Start

The example below wires a root Agenda configuration, registers a `notifications` queue, defines a processor, and schedules jobs at runtime with a typed payload.

```ts
import { Injectable, Module } from "@nestjs/common";
import type { Job } from "agenda";
import {
  AgendaModule,
  AgendaQueue,
  Define,
  InjectQueue,
  Queue,
} from "@gnurub/agenda-nest";

type NotificationPayload = {
  to: string;
  subject: string;
  body: string;
};

@Queue("notifications")
@Injectable()
export class NotificationsQueue {
  @Define({ name: "send-email", priority: "high", concurrency: 10 })
  async sendEmail(job: Job<NotificationPayload>) {
    const { to, subject, body } = job.attrs.data;

    await emailClient.send({ to, subject, body });
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue("notifications")
    private readonly queue: AgendaQueue,
  ) {}

  async sendWelcomeEmail(to: string) {
    await this.queue.now("send-email", {
      to,
      subject: "Welcome",
      body: "Thanks for joining.",
    });
  }
}

@Module({
  imports: [
    AgendaModule.forRoot({
      processEvery: "30 seconds",
      backend: {
        type: "mongo",
        options: {
          address: "mongodb://127.0.0.1:27017/agenda-nest",
        },
      },
    }),
    AgendaModule.registerQueue("notifications"),
  ],
  providers: [NotificationsQueue, NotificationsService],
})
export class AppModule {}
```

## Root Configuration

`AgendaModule.forRoot()` configures the shared Agenda runtime settings and backend definition.

```ts
import { Module } from "@nestjs/common";
import { AgendaModule } from "@gnurub/agenda-nest";

@Module({
  imports: [
    AgendaModule.forRoot({
      processEvery: "1 minute",
      defaultConcurrency: 5,
      maxConcurrency: 20,
      defaultLockLifetime: 10 * 60 * 1000,
      backend: {
        type: "mongo",
        options: {
          address: "mongodb://localhost:27017/app",
          collection: "agendaJobs",
          ensureIndex: true,
        },
      },
    }),
  ],
})
export class AppModule {}
```

You can also configure it asynchronously.

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AgendaModule } from "@gnurub/agenda-nest";

@Module({
  imports: [
    ConfigModule.forRoot(),
    AgendaModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        processEvery: config.get("queues.processEvery", "30 seconds"),
        backend: {
          type: "postgres",
          options: {
            connectionString: config.getOrThrow<string>("DATABASE_URL"),
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

Supported backend definitions:

- built-in MongoDB backend
- built-in PostgreSQL backend
- built-in Redis backend
- a custom factory function returning an Agenda backend
- a `{ type: 'custom', factory }` definition

## Queue Configuration

Each queue inherits the root runtime configuration and can override queue-specific settings.

```ts
import { Module } from "@nestjs/common";
import { AgendaModule } from "@gnurub/agenda-nest";

@Module({
  imports: [
    AgendaModule.registerQueue("notifications", {
      autoStart: false,
      processEvery: "15 seconds",
      namespace: "notifications",
      collection: "notifications-queue",
    }),
    AgendaModule.registerQueue("reports", {
      namespace: "analytics",
    }),
  ],
})
export class QueuesModule {}
```

Queue options:

- `autoStart`: start the queue automatically on bootstrap, defaults to `true`
- `namespace`: internal namespace prefix used for job names, defaults to the queue name
- `collection`: MongoDB collection override, defaults to `<queueName>-queue`
- any Agenda runtime option supported by `AgendaOptions` except `backend`
- an optional queue-level backend override

Asynchronous queue configuration is also supported.

```ts
AgendaModule.registerQueueAsync("notifications", {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    autoStart: config.get("queues.notifications.autoStart", true),
    processEvery: config.get("queues.notifications.processEvery", "30 seconds"),
  }),
});
```

## Defining Job Processors

Use `@Queue()` on the class and `@Define()` on methods that should become Agenda processors.

```ts
import { Injectable } from "@nestjs/common";
import type { Job } from "agenda";
import { Define, Queue } from "@gnurub/agenda-nest";

type ReportPayload = {
  reportId: string;
  format: "csv" | "pdf";
};

@Queue("reports")
@Injectable()
export class ReportsQueue {
  @Define({
    name: "generate-report",
    concurrency: 2,
    priority: "high",
    lockLifetime: 60_000,
  })
  async generateReport(job: Job<ReportPayload>) {
    const { reportId, format } = job.attrs.data;

    await reportsService.generate(reportId, format);
  }
}
```

The processor receives the original Agenda `Job` instance. Agenda Nest does not rewrite your payload when a job is executed. Your data is available under `job.attrs.data`, exactly as scheduled.

## Scheduling Jobs

Agenda Nest supports two scheduling styles:

1. static scheduling declared with decorators during bootstrap
2. runtime scheduling through `AgendaQueue`

### Static Scheduling with Decorators

Use decorators when the schedule is known at boot time.

```ts
import type { Job } from "agenda";
import { Every, Now, Queue, Schedule } from "@gnurub/agenda-nest";

@Queue("reports")
export class ReportsQueue {
  @Every({ name: "sync-metrics", interval: "5 minutes" })
  async syncMetrics(job: Job) {
    await metricsService.sync();
  }

  @Schedule({ name: "daily-summary", when: "tomorrow at 08:00" })
  async dailySummary(job: Job) {
    await summaryService.send();
  }

  @Now("warm-cache")
  async warmCache(job: Job) {
    await cacheService.warm();
  }
}
```

Decorator-based schedulers are intended for static jobs. If you need to pass runtime payloads per request, use the manual queue API shown below.

### Runtime Scheduling with `AgendaQueue`

Use `@InjectQueue()` when payloads come from application code at runtime.

```ts
import { Injectable } from "@nestjs/common";
import { AgendaQueue, InjectQueue } from "@gnurub/agenda-nest";

@Injectable()
export class ReportsService {
  constructor(@InjectQueue("reports") private readonly queue: AgendaQueue) {}

  async scheduleReport(reportId: string) {
    await this.queue.schedule("in 10 minutes", "generate-report", {
      reportId,
      format: "pdf",
    });
  }

  async scheduleDigest(userId: string) {
    await this.queue.every(
      "1 day",
      "generate-report",
      { reportId: userId, format: "csv" },
      { timezone: "UTC", skipImmediate: true },
    );
  }

  async runImmediately(reportId: string) {
    await this.queue.now("generate-report", {
      reportId,
      format: "pdf",
    });
  }
}
```

The `AgendaQueue` facade automatically prefixes internal names like `reports::generate-report` before calling Agenda, but it leaves your payload untouched.

## Listening to Queue Events

Use decorators to subscribe to queue-level and job-level events.

```ts
import type { Job } from "agenda";
import {
  OnJobComplete,
  OnJobFail,
  OnJobSuccess,
  OnQueueError,
  OnQueueReady,
  Queue,
} from "@gnurub/agenda-nest";

@Queue("notifications")
export class NotificationsListeners {
  @OnQueueReady()
  onReady() {
    logger.log("Notifications queue is ready");
  }

  @OnQueueError()
  onError(error: Error) {
    logger.error(error.message, error.stack);
  }

  @OnJobSuccess("send-email")
  onEmailSent(job: Job<{ to: string }>) {
    logger.log(`Sent email to ${job.attrs.data.to}`);
  }

  @OnJobComplete("send-email")
  onComplete(job: Job) {
    logger.log(`Completed ${job.attrs.name}`);
  }

  @OnJobFail("send-email")
  onFailure(error: Error, job: Job<{ to: string }>) {
    logger.error(
      `Failed to send email to ${job.attrs.data.to}: ${error.message}`,
    );
  }
}
```

When a job is received through queue-scoped listeners, Agenda Nest normalizes only queue-specific name fields:

- `job.attrs.name` loses the internal `<namespace>::` prefix
- log entries returned by the facade normalize `jobName` the same way

Everything else stays intact, including:

- `job.attrs.data`
- `failCount`
- `nextRunAt`
- the job prototype and its methods

## Working with Queues Manually

`@InjectQueue()` injects an `AgendaQueue`, not the raw Agenda instance.

Available methods include:

- `define()`
- `create()`
- `every()`
- `schedule()`
- `now()`
- `queryJobs()`
- `cancel()`
- `getLogs()`
- `clearLogs()`
- `on()`, `once()`, `off()`, `removeListener()`
- `start()`, `stop()`, `drain()`
- `getRawAgenda()`

Example:

```ts
import { Injectable } from "@nestjs/common";
import { AgendaQueue, InjectQueue } from "@gnurub/agenda-nest";

@Injectable()
export class NotificationsAdminService {
  constructor(
    @InjectQueue("notifications")
    private readonly queue: AgendaQueue,
  ) {}

  async listPendingJobs() {
    return this.queue.queryJobs({
      name: "send-email",
      limit: 20,
      sort: { nextRunAt: "asc" },
    });
  }

  async cancelPendingJobs() {
    return this.queue.cancel({ names: ["send-email", "send-reminder"] });
  }

  get agenda() {
    return this.queue.getRawAgenda();
  }
}
```

Use `getRawAgenda()` when you need an Agenda feature that is not yet exposed by the queue facade.

## Testing

This repository uses Vitest.

Available commands:

```bash
npm run test:unit
npm run test:e2e
npm run test:smoke
npm run test:coverage
```

### What to Test

For package-level tests, the most valuable checks are:

- queue name namespacing
- processor registration and scheduling
- event wiring
- payload integrity, especially `job.attrs.data`
- preservation of job attributes when queue-scoped listeners normalize names

### Example Unit Test

```ts
import { AgendaQueue } from "@gnurub/agenda-nest";
import { describe, expect, it, vi } from "vitest";

describe("AgendaQueue", () => {
  it("keeps job attrs.data intact for queue-scoped listeners", () => {
    const payload = { to: "user@example.com", nested: { retries: 1 } };
    const listener = vi.fn();

    class FakeJob {
      constructor(public attrs: Record<string, unknown>) {}
    }

    const agenda = {
      on: vi.fn((eventName: string, handler: (job: FakeJob) => void) => {
        handler(
          new FakeJob({
            name: "notifications::send-email",
            data: payload,
            failCount: 2,
          }),
        );
      }),
    } as any;

    const queue = new AgendaQueue(agenda, "notifications");
    queue.on("success:send-email", listener);

    const normalizedJob = listener.mock.calls[0][0];

    expect(normalizedJob.attrs).toEqual({
      name: "send-email",
      data: payload,
      failCount: 2,
    });
    expect(normalizedJob.attrs.data).toBe(payload);
  });
});
```

That last assertion is important: the queue facade normalizes internal names, but it should not strip or rewrite the job payload.

The repository also includes:

- unit tests for the queue facade, module registration, factories, and metadata discovery
- end-to-end tests for module wiring and queue events
- a smoke test for the `examples/multiple-queues` application

## Migration Notes

If you are migrating from an older version of this package or from a pre-v6 Agenda setup:

- Agenda v6 uses explicit backends instead of the old implicit MongoDB configuration
- `AgendaModule.forRoot()` now expects a `backend` definition
- `@InjectQueue()` injects `AgendaQueue`, not the raw `Agenda` instance
- multiple queues are isolated through internal job-name namespacing
- runtime payload scheduling should go through `AgendaQueue` methods such as `schedule()`, `every()`, `now()`, or `create()`

## License

Agenda Nest is [MIT licensed](https://github.com/jongolden/agenda-nest/blob/main/LICENSE).
