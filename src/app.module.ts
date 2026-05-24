import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Neo4jModule } from './apps/modules/neo4j/neo4j.module';
import { PersonModule } from './apps/modules/person/person.module';
import { PostgresModule } from './apps/modules/postgres/postgres.module';
import { InvestigationModule } from './apps/modules/investigation/investigation.module';

@Module({
  imports: [Neo4jModule, PersonModule, PostgresModule, InvestigationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
