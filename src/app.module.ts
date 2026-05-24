import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Neo4jModule } from './apps/modules/neo4j/neo4j.module';
import { PersonModule } from './apps/modules/person/person.module';

@Module({
  imports: [Neo4jModule, PersonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
