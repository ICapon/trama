import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';
import { Investigation } from '../investigation/investigation.entity';
import { Upload } from '../upload/upload.entity';

@Module({
  imports: [Neo4jModule, TypeOrmModule.forFeature([Investigation, Upload])],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
