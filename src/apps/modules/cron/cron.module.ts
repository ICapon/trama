import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronJobEntity } from './cron-job.entity';
import { CronJobService } from './cron-job.service';
import { CronJobController } from './cron-job.controller';
import { SCRAPER_QUEUE } from '../scraper/queue/scraper.queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([CronJobEntity]),
    BullModule.registerQueue({ name: SCRAPER_QUEUE }),
  ],
  controllers: [CronJobController],
  providers: [CronJobService],
})
export class CronModule {}
