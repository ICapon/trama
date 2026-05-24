import { Module } from '@nestjs/common';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';

@Module({
  imports: [Neo4jModule],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
