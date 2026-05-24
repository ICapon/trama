import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { PersonService } from './person.service';
import { CreatePersonSchema, type CreatePersonDto } from '../../../libs/schemas/person.schema';
import { CreatePersonRelationshipSchema, type CreatePersonRelationshipDto } from '../../../libs/schemas/person-relationship.schema';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import { PERSON_RELATIONSHIP_TYPES, type PersonRelationshipType } from '../graph/const/relationship-types.const';
import { BadRequestException } from '@nestjs/common';

@Controller('person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreatePersonSchema)) dto: CreatePersonDto) {
    return this.personService.create(dto);
  }

  @Post(':fromId/relationship')
  linkPersons(
    @Param('fromId') fromId: string,
    @Body(new ZodValidationPipe(CreatePersonRelationshipSchema)) dto: CreatePersonRelationshipDto,
  ) {
    return this.personService.linkPersons(fromId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.personService.remove(id);
  }

  @Delete(':fromId/relationship/:toId/:type')
  @HttpCode(204)
  removeRelationship(
    @Param('fromId') fromId: string,
    @Param('toId') toId: string,
    @Param('type') type: string,
  ) {
    if (!(PERSON_RELATIONSHIP_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`Invalid relationship type: "${type}"`);
    }
    return this.personService.removeRelationship(fromId, toId, type as PersonRelationshipType);
  }
}
