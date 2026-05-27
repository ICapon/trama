import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, Repository } from 'typeorm';
import type { Node, Relationship } from 'neo4j-driver';
import { Neo4jService } from '../neo4j/neo4j.service';
import { Investigation } from '../investigation/investigation.entity';
import { TRAMA_NODE_TYPE_SET } from './const/node-categories.const';
import { TRAMA_RELATIONSHIP_TYPE_SET } from './const/relationship-types.const';
import { createEntityNodeQuery } from './queries/create-node.query';
import { UPDATE_NODE_QUERY } from './queries/update-node.query';
import { createRelationshipQuery } from './queries/create-relationship.query';
import { DELETE_NODE_QUERY } from './queries/delete-node.query';
import {
  FIND_ENTITIES_BY_TYPE_QUERY,
  FIND_ENTITIES_BY_VALUE_QUERY,
  FIND_ENTITY_BY_ID_QUERY,
  FIND_GRAPH_BY_NODE_IDS_QUERY,
  FIND_NEIGHBORS_QUERY,
  FIND_NODE_RELATIONSHIPS_QUERY,
  FIND_SHORTEST_PATH_QUERY,
  DELETE_RELATIONSHIP_QUERY,
  SEARCH_ENTITIES_BY_TEXT_QUERY,
  findNeighborsByDepthQuery,
} from './queries/find-node.query';
import type { CreateEntityInput, CreateRelationshipInput } from './graph.types';
import { toGraphEdgeResponse, toGraphNodeResponse } from '../../../libs/mappers/graph.mapper';
import type { GraphEdgeResponse, GraphNodeResponse } from '../../../libs/schemas/graph-node-response.schema';

@Injectable()
export class GraphService {
  constructor(
    private readonly neo4j: Neo4jService,
    @InjectRepository(Investigation)
    private readonly investigationRepo: Repository<Investigation>,
  ) {}

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

    const fromNode = toGraphNodeResponse(record.get('from'));
    const toNode   = toGraphNodeResponse(record.get('to'));
    const edge     = toGraphEdgeResponse(record.get('r'), fromNode.id, toNode.id);

    return { nodes: [fromNode, toNode], edge };
  }

  async updateEntity(id: string, properties: Record<string, unknown>) {
    // Prevent overwriting immutable fields
    const { id: _id, type: _type, createdAt: _ca, ...safe } = properties;

    const result = await this.neo4j.write(UPDATE_NODE_QUERY, {
      id,
      properties: safe,
      updatedAt: new Date().toISOString(),
    });

    const raw = result.records[0]?.get('n');
    if (!raw) throw new NotFoundException(`Node ${id} not found`);
    return toGraphNodeResponse(raw);
  }

  async findEntityById(id: string) {
    const result = await this.neo4j.read(FIND_ENTITY_BY_ID_QUERY, { id });
    const raw = result.records[0]?.get('n');
    return raw ? toGraphNodeResponse(raw) : null;
  }

  async findEntitiesByType(type: string) {
    this.validateNodeType(type);
    const result = await this.neo4j.read(FIND_ENTITIES_BY_TYPE_QUERY, { type });
    return result.records.map((r) => toGraphNodeResponse(r.get('n')));
  }

  async findEntitiesByValue(normalizedValue: string) {
    const result = await this.neo4j.read(FIND_ENTITIES_BY_VALUE_QUERY, {
      normalizedValue,
    });
    return result.records.map((r) => toGraphNodeResponse(r.get('n')));
  }

  async searchEntitiesByText(text: string, limit = 25) {
    const result = await this.neo4j.read(SEARCH_ENTITIES_BY_TEXT_QUERY, {
      text,
      limit,
    });
    return result.records.map((r) => ({
      node: toGraphNodeResponse(r.get('n')),
      score: r.get('score') as number,
    }));
  }

  async findNeighbors(id: string, depth = 1) {
    const query = depth === 1 ? FIND_NEIGHBORS_QUERY : findNeighborsByDepthQuery(depth);
    const result = await this.neo4j.read(query, { id });
    return result.records.map((r) => {
      const neighbor = toGraphNodeResponse(r.get('neighbor'));
      const rel = r.get('rel');
      return {
        neighbor,
        edge: rel ? toGraphEdgeResponse(rel, id, neighbor.id) : null,
      };
    });
  }

  async findShortestPath(fromId: string, toId: string) {
    const result = await this.neo4j.read(FIND_SHORTEST_PATH_QUERY, { fromId, toId });
    return result.records[0]?.get('p') ?? null;
  }

  async findGraphByNodeIds(ids: string[]): Promise<{ nodes: GraphNodeResponse[]; edges: GraphEdgeResponse[] }> {
    if (!ids.length) return { nodes: [], edges: [] };

    const result = await this.neo4j.read(FIND_GRAPH_BY_NODE_IDS_QUERY, { ids });

    const nodeMap = new Map<string, GraphNodeResponse>();
    const edgeMap = new Map<string, GraphEdgeResponse>();

    for (const record of result.records) {
      const rawN = record.get('n') as Node;
      const rawR = record.get('r') as Relationship | null;
      const rawNeighbor = record.get('neighbor') as Node | null;

      const n = toGraphNodeResponse(rawN);
      nodeMap.set(n.id, n);

      if (rawR && rawNeighbor) {
        const neighbor = toGraphNodeResponse(rawNeighbor);
        if (!neighbor.id) continue;
        nodeMap.set(neighbor.id, neighbor);

        const fromId = rawR.startNodeElementId === rawN.elementId ? n.id : neighbor.id;
        const toId = rawR.startNodeElementId === rawN.elementId ? neighbor.id : n.id;
        const edge = toGraphEdgeResponse(rawR, fromId, toId);
        edgeMap.set(edge.id, edge);
      }
    }

    // Drop edges that reference a node not in the map (avoids reagraph null-key errors).
    const validEdges = [...edgeMap.values()].filter(
      (e) => nodeMap.has(e.source) && nodeMap.has(e.target),
    );

    return { nodes: [...nodeMap.values()], edges: validEdges };
  }

  async findRelationships(id: string, relType?: string): Promise<GraphEdgeResponse[]> {
    const result = await this.neo4j.read(FIND_NODE_RELATIONSHIPS_QUERY, {
      id,
      relType: relType ?? null,
    });

    return result.records.map((record) => {
      const n = record.get('n') as import('neo4j-driver').Node;
      const r = record.get('r') as import('neo4j-driver').Relationship;
      const neighbor = record.get('neighbor') as import('neo4j-driver').Node;

      const nProps = n.properties as Record<string, unknown>;
      const neighborProps = neighbor.properties as Record<string, unknown>;

      const fromId = r.startNodeElementId === n.elementId
        ? (nProps.id as string)
        : (neighborProps.id as string);
      const toId = r.startNodeElementId === n.elementId
        ? (neighborProps.id as string)
        : (nProps.id as string);

      return toGraphEdgeResponse(r, fromId, toId);
    });
  }

  async deleteRelationship(fromId: string, toId: string, type: string): Promise<void> {
    this.validateRelationshipType(type);
    const result = await this.neo4j.write(DELETE_RELATIONSHIP_QUERY, { fromId, toId, type });
    const deleted = result.records[0]?.get('deleted')?.toNumber() ?? 0;
    if (deleted === 0) {
      throw new NotFoundException(`Relationship ${type} between ${fromId} and ${toId} not found`);
    }
  }

  async removeNode(id: string) {
    const result = await this.neo4j.write(DELETE_NODE_QUERY, { id });
    if (!result.records[0]) {
      throw new NotFoundException(`Node ${id} not found`);
    }

    const affected = await this.investigationRepo.find({
      where: { targetNodeIds: ArrayContains([id]) },
    });

    for (const inv of affected) {
      const idx = inv.targetNodeIds.indexOf(id);
      inv.targetNodeIds = inv.targetNodeIds.filter((_, i) => i !== idx);
      inv.targetNodeLabels = inv.targetNodeLabels.filter((_, i) => i !== idx);
      inv.targetNodeTypes = inv.targetNodeTypes.filter((_, i) => i !== idx);
    }

    if (affected.length) await this.investigationRepo.save(affected);
  }
}
