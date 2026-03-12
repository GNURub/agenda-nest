# Agenda Nest

<a href="https://www.npmjs.com/package/agenda-nest" target="_blank"><img src="https://img.shields.io/npm/v/agenda-nest.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/package/agenda-nest" target="_blank"><img src="https://img.shields.io/npm/l/agenda-nest.svg" alt="Package License" /></a>

</p>

A lightweight job scheduler for NestJS

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Configure Agenda](#configure-agenda)
- [Job processors](#job-processors)
- [Job schedulers](#job-schedulers)
- [Event listeners](#event-listeners)
- [Manually working with a queue](#manually-working-with-a-queue)
- [License](#license)

## Background

Agenda Nest provides a NestJS module wrapper for [Agenda](https://github.com/agenda/agenda), a lightweight job scheduling library. Heavily inspired by Nest's own Bull implementation, [@nestjs/bull](https://github.com/nestjs/bull), Agenda Nest provides a fully-featured implementation, complete with decorators for defining your jobs, processors and queue event listeners. You may optionally, make use of Agenda Nest's Express controller to interface with your queues through HTTP.

### Dependencies

Agenda v6 uses explicit backends. This package supports MongoDB, PostgreSQL, Redis, or a custom Agenda backend factory. Install the backend package you plan to use in your Nest application.

## Install

```bash
npm install agenda-nest agenda @agendajs/mongo-backend
```

For PostgreSQL or Redis, replace the backend package accordingly.

## Configure Agenda

Agenda Nest now uses Agenda v6 configuration. Root configuration combines Agenda runtime options with a backend definition. Queue configuration can override runtime options, `autoStart`, `collection` for MongoDB, `namespace`, and even the backend definition itself.

### Synchronously

```ts
import { Module } from '@nestjs/common';
import { AgendaModule } from 'agenda-nest';

@Module({
  imports: [
    AgendaModule.forRoot({
      processEvery: '3 minutes',
      backend: {
        type: 'mongo',
        options: {
          address: 'mongodb://localhost:27017/agenda-nest',
          ensureIndex: true,
        },
      },
    }),
  ],
  providers: [Jobs],
})
export class AppModule {}
```

### Asynchronously

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AgendaModule } from 'agenda-nest';
import configuration from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
    AgendaModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        processEvery: config.get('queues.processInterval'),
        backend: {
          type: 'mongo',
          options: {
            address: config.get('database.connectionString'),
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [Jobs],
})
export class AppModule {}
```

## Configure queues

Agenda Nest can manage multiple queues within your application. To configure a new queue use `AgendaModule.registerQueue(queueName: string, config?: AgendaQueueConfig)`. Queues inherit the root configuration, but each queue is isolated through an internal namespace and may override runtime options or even the backend definition.

### Synchronously

```ts
import { Module } from '@nestjs/common';
import { AgendaModule } from 'agenda-nest';

@Module({
  imports: [
    AgendaModule.registerQueue('notifications', {
      processEvery: '5 minutes',
      autoStart: false, // default: true
      collection: 'notificationsqueue', // default: notifications-queue (`${queueName}-queue`)
      namespace: 'notifications', // default: queue name
    }),
  ],
})
export class NotificationsModule {}
```

### Asynchronously

```js
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AgendaModule } from 'agenda-nest';

@Module({
  imports: [
    AgendaModule.registerQueueAsync('notifications', {
      useFactory: (config: ConfigService) => ({
        processEvery: config.get('queues.notifications.processInterval'),
        autoStart: config.get('queues.notifications.autoStart'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class NotificationsModule {}
```

## Job processors

Job processors are methods defined on a class declared with the `@Queue(name: string)` decorator. Queue names are internally namespaced so multiple queues can safely define the same job names even when they share the same backend.

```js
import { Queue } from 'agenda-nest';

// will use a "notifications-queue" collection
@Queue('notifications')
export class NotificationsQueue {}

// with custom collection name
@Queue('notifications')
export class NotificationsQueue {}
```

To **define**, but not schedule, a job on the queue, use the `@Define()` decorator as shown below. To define a scheduled job, see [Job schedulers](#job-schedulers).

```js
import { Define, Queue } from 'agenda-nest';

@Queue('notifications')
export class NotificationsQueue {
  @Define()
  async sendNotification() {}
}
```

## Job schedulers

To define and schedule a job on the queue, use one of the `@Every()`, `@Schedule()`, or `@Now()` decorators. See Agenda's [Creating Jobs](https://github.com/agenda/agenda#creating-jobs) documentation for an explanation on the behavior of each.

### `@Every(nameOrOptions: string | JobOptions)`

Defines a job to run at the given interval

```js
import { Every, Queue } from 'agenda-nest';

@Queue('notifications')
export class NotificationsQueue {
  @Every({ name: 'send notifications', interval: '15 minutes' })
  async sendNotifications() {
    const users = await User.doSomethingReallyIntensive();
    sendNotification(users, 'Welcome!');
  }
}

@Queue('reports')
export class ReportsQueue {
  @Every('15 minutes')
  async printAnalyticsReport() {
    const users = await User.doSomethingReallyIntensive();
    processUserData(users);
  }
}
```

### `@Schedule(nameOrOptions: string | JobOptions)`

Schedules a job to run once at the given time.

```js
import { Schedule, Queue } from 'agenda-nest';

@Queue('notifications')
export class NotificationsQueue {
  @Schedule({ name: 'send notifications', when: 'tomorrow at noon' })
  async sendNotifications() {
    const users = await User.doSomethingReallyIntensive();
    sendNotification(users, 'Welcome!');
  }
}

@Queue('reports')
export class ReportsQueue {
  @Schedule('tomorrow at noon')
  async printAnalyticsReport() {
    const users = await User.doSomethingReallyIntensive();
    processUserData(users);
  }
}
```

### `@Now(name?: string)`

Schedules a job to run once immediately.

```js
import { Now, Queue } from 'agenda-nest';

@Queue('dance')
export class DanceQueue {
  @Now()
  async doTheHokeyPokey() {
    hokeyPokey();
  }

  @Now('do the cha-cha')
  async doTheChaCha() {
    chaCha();
  }
}
```

## Event Listeners

Agenda generates a set of useful events when queue and/or job state changes occur. Agenda NestJS provides a set of decorators that allow subscribing to a core set of standard events.

Event listeners must be declared within an injectable class (i.e., within a class decorated with the @Queue() decorator). To listen for an event, use one of the decorators in the table below to declare a handler for the event. For example, to listen to the event emitted when a job enters the active state in the audio queue, use the following construct:

```js
import { OnQueueReady } from 'agenda-nest';
import { Job } from 'agenda';

@Queue()
export class JobsQueue {
  @OnQueueReady()
  onReady() {
    console.log('Jobs queue is ready to run our jobs');
  }
  ...
```

### Agenda Events

An instance of an agenda will emit the queue events listed below. Use the corresponding method decorator to listen for and handle each event.

| Event   | Listener          |                                                                                |
| :------ | :---------------- | :----------------------------------------------------------------------------- |
| `ready` | `@OnQueueReady()` | called when Agenda mongo connection is successfully opened and indices created |
| `error` | `@OnQueueError()` | called when Agenda mongo connection process has thrown an error                |

### Job Queue Events

An instance of an agenda will emit the job events listed below. Use the corresponding method decorator to listen for and handle each event.

| Event                             | Listener                        |                                                                   |
| :-------------------------------- | :------------------------------ | :---------------------------------------------------------------- |
| `start` or `start:job name`       | `@OnJobStart(name?: string)`    | called just before a job starts                                   |
| `complete` or `complete:job name` | `@OnJobComplete(name?: string)` | called when a job finishes, regardless of if it succeeds or fails |
| `success` or `success:job name`   | `@OnJobSuccess(name?: string)`  | called when a job finishes successfully                           |
| `fail` or `fail:job name`         | `@OnJobFail(name?: string)`     | called when a job throws an error                                 |

## Manually working with a queue

You can access any registered queue using the `@InjectQueue(queueName)` decorator, which injects an `AgendaQueue` facade scoped to that queue. The facade namespaces job names and named events automatically, while still exposing `getRawAgenda()` when you need the underlying Agenda instance.

```js
import { AgendaQueue, InjectQueue } from 'agenda-nest';

@Injectable()
export class NotificationsService {
  constructor(@InjectQueue('notifications') private queue: AgendaQueue) {}

  async scheduleNotification(sendAt: string) {
    await this.queue.schedule(sendAt, 'sendNotification', {
      to: 'user@example.com',
    });
  }
}
```

## Migration Notes

- `db` and `mongo` root configuration were removed in favor of `backend`.
- Agenda v6 is ESM-only; this package now publishes dual ESM/CJS builds and loads Agenda dynamically.
- `@InjectQueue()` now injects `AgendaQueue` instead of the raw `Agenda` instance.
- Multiple queues are isolated through internal job namespacing, so duplicate job names across queues are supported for every backend.

## License

Agenda Nest is [MIT licensed](https://github.com/jongolden/agenda-nest/blob/main/LICENSE).
