import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [GraphModule],
  controllers: [PersonController],
  providers: [PersonService],
})
export class PersonModule {}
