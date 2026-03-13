import { AgendaModule } from '@gnurub/agenda-nest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AgendaModule.forRoot({
      processEvery: '30 seconds',
      backend: {
        type: 'mongo',
        options: {
          address:
            process.env.MONGO_URI ||
            'mongodb://localhost:27017/agenda-nest-example',
        },
      },
    }),
    NotificationsModule,
    ReportsModule,
  ],
})
export class AppModule {}
