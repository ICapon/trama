import { Module } from '@nestjs/common';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { GraphService } from './graph.service';

@Module({
  imports: [Neo4jModule],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
