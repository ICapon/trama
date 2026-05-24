import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { TRAMA_NODE_TYPE_SET } from './const/node-categories.const';
import { TRAMA_RELATIONSHIP_TYPE_SET } from './const/relationship-types.const';
import { createEntityNodeQuery } from './queries/create-node.query';
import { createRelationshipQuery } from './queries/create-relationship.query';
import { DELETE_NODE_QUERY } from './queries/delete-node.query';
import {
  FIND_ENTITIES_BY_TYPE_QUERY,
  FIND_ENTITIES_BY_VALUE_QUERY,
  FIND_ENTITY_BY_ID_QUERY,
  FIND_NEIGHBORS_QUERY,
  FIND_SHORTEST_PATH_QUERY,
  SEARCH_ENTITIES_BY_TEXT_QUERY,
  findNeighborsByDepthQuery,
} from './queries/find-node.query';
import type { CreateEntityInput, CreateRelationshipInput } from './graph.types';

@Injectable()
export class GraphService {
  constructor(private readonly neo4j: Neo4jService) {}

  validateNodeType(type: string): void {
    if (!TRAMA_NODE_TYPE_SET.has(type)) {
      throw new BadRequestException(`Invalid node type: "${type}"`);
    }
  }

  validateRelationshipType(type: string): void {
    if (!TRAMA_RELATIONSHIP_TYPE_SET.has(type)) {
      throw new BadRequestException(`Invalid relationship type: "${type}"`);
    }
  }

  async createEntity(input: CreateEntityInput) {
    this.validateNodeType(input.type);
    const query = createEntityNodeQuery(input.type);
    const now = new Date().toISOString();

    const result = await this.neo4j.write(query, {
      id: input.id,
      type: input.type,
      properties: {
        ...input.properties,
        type: input.type,
        createdAt: input.properties?.createdAt ?? now,
        updatedAt: now,
      },
    });

    return result.records[0]?.get('n') ?? null;
  }

  async createRelationship(input: CreateRelationshipInput) {
    this.validateRelationshipType(input.type);
    const query = createRelationshipQuery(input.type);
    const now = new Date().toISOString();

    const result = await this.neo4j.write(query, {
      fromId: input.fromId,
      toId: input.toId,
      properties: {
        ...input.properties,
        createdAt: input.properties?.createdAt ?? now,
        updatedAt: now,
      },
    });

    const record = result.records[0];
    if (!record) return null;
    return { from: record.get('from'), r: record.get('r'), to: record.get('to') };
  }

  async findEntityById(id: string) {
    const result = await this.neo4j.read(FIND_ENTITY_BY_ID_QUERY, { id });
    return result.records[0]?.get('n') ?? null;
  }

  async findEntitiesByType(type: string) {
    this.validateNodeType(type);
    const result = await this.neo4j.read(FIND_ENTITIES_BY_TYPE_QUERY, { type });
    return result.records.map((r) => r.get('n'));
  }

  async findEntitiesByValue(normalizedValue: string) {
    const result = await this.neo4j.read(FIND_ENTITIES_BY_VALUE_QUERY, {
      normalizedValue,
    });
    return result.records.map((r) => r.get('n'));
  }

  async searchEntitiesByText(text: string, limit = 25) {
    const result = await this.neo4j.read(SEARCH_ENTITIES_BY_TEXT_QUERY, {
      text,
      limit,
    });
    return result.records.map((r) => ({ node: r.get('n'), score: r.get('score') }));
  }

  async findNeighbors(id: string, depth = 1) {
    const query = depth === 1 ? FIND_NEIGHBORS_QUERY : findNeighborsByDepthQuery(depth);
    const result = await this.neo4j.read(query, { id });
    return result.records.map((r) => ({
      neighbor: r.get('neighbor'),
      rel: r.get('rel'),
    }));
  }

  async findShortestPath(fromId: string, toId: string) {
    const result = await this.neo4j.read(FIND_SHORTEST_PATH_QUERY, { fromId, toId });
    return result.records[0]?.get('p') ?? null;
  }

  async removeNode(id: string) {
    const result = await this.neo4j.write(DELETE_NODE_QUERY, { id });
    if (!result.records[0]) {
      throw new NotFoundException(`Node ${id} not found`);
    }
  }
}
