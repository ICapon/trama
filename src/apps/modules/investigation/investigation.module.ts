import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Investigation } from './investigation.entity';
import { InvestigationService } from './investigation.service';
import { InvestigationController } from './investigation.controller';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [TypeOrmModule.forFeature([Investigation]), GraphModule],
  controllers: [InvestigationController],
  providers: [InvestigationService],
  exports: [InvestigationService],
})
export class InvestigationModule {}
