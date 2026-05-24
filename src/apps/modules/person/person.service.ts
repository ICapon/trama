import { Injectable, NotFoundException } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { GraphService } from '../graph/graph.service';
import { createPersonRelationshipQuery } from '../graph/queries/create-person-relationship.query';
import { DELETE_PERSON_QUERY } from '../graph/queries/delete-person.query';
import { deletePersonRelationshipQuery } from '../graph/queries/delete-person-relationship.query';
import type { CreatePersonDto } from '../../../libs/schemas/person.schema';
import type { CreatePersonRelationshipDto } from '../../../libs/schemas/person-relationship.schema';
import type { PersonRelationshipType } from '../graph/const/relationship-types.const';

@Injectable()
export class PersonService {
  constructor(
    private readonly graph: GraphService,
    private readonly neo4j: Neo4jService,
  ) {}

  async create(dto: CreatePersonDto) {
    const id = crypto.randomUUID();
    const nameParts = [dto.firstName, dto.middleName, dto.lastName, dto.secondLastName].filter(Boolean);
    const fullName = nameParts.join(' ');

    return this.graph.createEntity({
      id,
      type: 'Person',
      properties: {
        ...dto,
        name: fullName,
        fullName,
      },
    });
  }

  async linkPersons(fromId: string, dto: CreatePersonRelationshipDto) {
    const query = createPersonRelationshipQuery(dto.type);
    const now = new Date().toISOString();

    const result = await this.neo4j.write(query, {
      fromId,
      toId: dto.toId,
      properties: {
        relationType: dto.relationType,
        confidence: dto.confidence,
        reason: dto.reason,
        createdAt: now,
        updatedAt: now,
      },
    });

    const record = result.records[0];
    if (!record) {
      throw new NotFoundException('One or both persons not found');
    }

    return {
      from: record.get('from'),
      relationship: record.get('r'),
      to: record.get('to'),
    };
  }

  async remove(id: string) {
    const result = await this.neo4j.write(DELETE_PERSON_QUERY, { id });
    if (!result.records[0]) {
      throw new NotFoundException(`Person ${id} not found`);
    }
  }

  async removeRelationship(fromId: string, toId: string, type: PersonRelationshipType) {
    const query = deletePersonRelationshipQuery(type);
    const result = await this.neo4j.write(query, { fromId, toId });
    if (!result.records[0]) {
      throw new NotFoundException('Relationship not found');
    }
  }
}
