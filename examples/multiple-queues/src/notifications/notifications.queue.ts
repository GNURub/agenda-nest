import { AgendaQueue, Every, InjectQueue, Queue } from '@gnurub/agenda-nest';

@Queue('notifications')
export class NotificationsQueue {
  constructor(@InjectQueue('notifications') queue: AgendaQueue) {
    queue.on('complete:sendNotification', () => {
      console.log('notification sent');
    });
  }

  @Every('1 minute')
  sendNotification() {
    console.log('Sending notification to all users');
  }
}
