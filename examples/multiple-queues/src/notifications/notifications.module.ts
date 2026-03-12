import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AgendaModule, AgendaQueue } from 'agenda-nest';
import { NotificationsQueue } from './notifications.queue';

@Module({
  imports: [
    AgendaModule.registerQueue('notifications', {
      autoStart: false,
    }),
  ],
  providers: [NotificationsQueue],
})
export class NotificationsModule implements OnApplicationBootstrap {
  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

  async onApplicationBootstrap() {
    const queue = this.moduleRef.get<AgendaQueue>('notifications-queue', {
      strict: false,
    });
    await queue.start();
  }
}
