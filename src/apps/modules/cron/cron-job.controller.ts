import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CronJobService } from './cron-job.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import {
  CreateCronJobSchema,
  UpdateCronJobSchema,
  type CreateCronJobDto,
  type UpdateCronJobDto,
} from '../../../libs/schemas/cron-job.schema';

@Controller('cron-jobs')
export class CronJobController {
  constructor(private readonly cronJobService: CronJobService) {}

  @Get()
  findAll() {
    return this.cronJobService.findAll();
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateCronJobSchema)) dto: CreateCronJobDto) {
    return this.cronJobService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cronJobService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCronJobSchema)) dto: UpdateCronJobDto,
  ) {
    return this.cronJobService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.cronJobService.remove(id);
  }

  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.cronJobService.pause(id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.cronJobService.resume(id);
  }
}
