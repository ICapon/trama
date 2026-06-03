import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Investigation } from './investigation.entity';
import { GraphConfig } from './graph-config.entity';
import { InvestigationService } from './investigation.service';
import { InvestigationController } from './investigation.controller';
import { GraphConfigService } from './graph-config.service';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [TypeOrmModule.forFeature([Investigation, GraphConfig]), GraphModule],
  controllers: [InvestigationController],
  providers: [InvestigationService, GraphConfigService],
  exports: [InvestigationService],
})
export class InvestigationModule {}
