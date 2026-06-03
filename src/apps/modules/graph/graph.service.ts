import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, In, Repository } from 'typeorm';
import type { Node, Relationship } from 'neo4j-driver';
import { Neo4jService } from '../neo4j/neo4j.service';
import { Investigation } from '../investigation/investigation.entity';
import { Upload } from '../upload/upload.entity';
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
  FIND_NEIGHBORS_QUERY,
  FIND_NODE_RELATIONSHIPS_QUERY,
  FIND_SHORTEST_PATH_QUERY,
  DELETE_RELATIONSHIP_QUERY,
  SEARCH_ENTITIES_BY_TEXT_QUERY,
  findNeighborsByDepthQuery,
  findGraphByNodeIdsQuery,
} from './queries/find-node.query';
import {
  POST_METRICS_QUERY,
  TOP_HASHTAGS_QUERY,
  HASHTAG_COOCCURRENCE_QUERY,
  TOP_DOMAINS_QUERY,
  TOP_MENTIONS_QUERY,
  TOP_REPLIES_QUERY,
  TOP_RETWEETS_QUERY,
  NETWORK_STATS_QUERY,
} from './queries/social-analysis.query';
import type { CreateEntityInput, CreateRelationshipInput, GraphFilters } from './graph.types';
import { toGraphEdgeResponse, toGraphNodeResponse } from '../../../libs/mappers/graph.mapper';
import type { GraphEdgeResponse, GraphNodeResponse } from '../../../libs/schemas/graph-node-response.schema';

@Injectable()
export class GraphService {
  constructor(
    private readonly neo4j: Neo4jService,
    @InjectRepository(Investigation)
    private readonly investigationRepo: Repository<Investigation>,
    @InjectRepository(Upload)
    private readonly uploadRepo: Repository<Upload>,
  ) {}

  private async enrichWithUploads(nodes: GraphNodeResponse[]): Promise<GraphNodeResponse[]> {
    const uploadIds = nodes
      .map((n) => n.properties.uploadId as string | undefined)
      .filter((id): id is string => !!id);

    if (!uploadIds.length) return nodes;

    const uploads = await this.uploadRepo.findBy({ id: In(uploadIds) });
    const urlMap = new Map(uploads.map((u) => [u.id, u.url]));

    return nodes.map((n) => {
      const uploadId = n.properties.uploadId as string | undefined;
      return uploadId ? { ...n, uploadUrl: urlMap.get(uploadId) } : n;
    });
  }

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
    const [enrichedFrom, enrichedTo] = await this.enrichWithUploads([fromNode, toNode]);

    return { nodes: [enrichedFrom, enrichedTo], edge };
  }

  async updateEntity(id: string, properties: Record<string, unknown>) {
    const { id: _id, type: _type, createdAt: _ca, ...safe } = properties;

    const result = await this.neo4j.write(UPDATE_NODE_QUERY, {
      id,
      properties: safe,
      updatedAt: new Date().toISOString(),
    });

    const raw = result.records[0]?.get('n');
    if (!raw) throw new NotFoundException(`Node ${id} not found`);
    const [node] = await this.enrichWithUploads([toGraphNodeResponse(raw)]);
    return node;
  }

  async findEntityById(id: string) {
    const result = await this.neo4j.read(FIND_ENTITY_BY_ID_QUERY, { id });
    const raw = result.records[0]?.get('n');
    if (!raw) return null;
    const [node] = await this.enrichWithUploads([toGraphNodeResponse(raw)]);
    return node;
  }

  async findEntitiesByType(type: string) {
    this.validateNodeType(type);
    const result = await this.neo4j.read(FIND_ENTITIES_BY_TYPE_QUERY, { type });
    const nodes = result.records.map((r) => toGraphNodeResponse(r.get('n')));
    return this.enrichWithUploads(nodes);
  }

  async findEntitiesByValue(normalizedValue: string) {
    const result = await this.neo4j.read(FIND_ENTITIES_BY_VALUE_QUERY, { normalizedValue });
    const nodes = result.records.map((r) => toGraphNodeResponse(r.get('n')));
    return this.enrichWithUploads(nodes);
  }

  async searchEntitiesByText(text: string, limit = 25) {
    const result = await this.neo4j.read(SEARCH_ENTITIES_BY_TEXT_QUERY, { text, limit });
    const raw = result.records.map((r) => ({
      node: toGraphNodeResponse(r.get('n')),
      score: r.get('score') as number,
    }));
    const enriched = await this.enrichWithUploads(raw.map((r) => r.node));
    return raw.map((r, i) => ({ node: enriched[i], score: r.score }));
  }

  async findNeighbors(id: string, depth = 1) {
    const query = depth === 1 ? FIND_NEIGHBORS_QUERY : findNeighborsByDepthQuery(depth);
    const result = await this.neo4j.read(query, { id });
    const raw = result.records.map((r) => {
      const neighbor = toGraphNodeResponse(r.get('neighbor'));
      const rel = r.get('rel');
      return { neighbor, edge: rel ? toGraphEdgeResponse(rel, id, neighbor.id) : null };
    });
    const enriched = await this.enrichWithUploads(raw.map((r) => r.neighbor));
    return raw.map((r, i) => ({ neighbor: enriched[i], edge: r.edge }));
  }

  async findShortestPath(fromId: string, toId: string) {
    const result = await this.neo4j.read(FIND_SHORTEST_PATH_QUERY, { fromId, toId });
    return result.records[0]?.get('p') ?? null;
  }

  async findGraphByNodeIds(ids: string[], filters?: GraphFilters): Promise<{ nodes: GraphNodeResponse[]; edges: GraphEdgeResponse[] }> {
    if (!ids.length) return { nodes: [], edges: [] };

    const relTypes  = filters?.relationshipTypes ?? [];
    const depth     = filters?.depth     ?? 1;
    const direction = filters?.direction ?? 'both';
    const result = await this.neo4j.read(findGraphByNodeIdsQuery(depth, direction), { ids, relTypes });
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

    const enrichedNodes = await this.enrichWithUploads([...nodeMap.values()]);
    return { nodes: enrichedNodes, edges: validEdges };
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

  async findSocialAnalysis(id: string) {
    const [postRes, hashtagRes, cooccurRes, domainRes, mentionRes, replyRes, retweetRes, networkRes] =
      await Promise.all([
        this.neo4j.read(POST_METRICS_QUERY,           { id }),
        this.neo4j.read(TOP_HASHTAGS_QUERY,           { id }),
        this.neo4j.read(HASHTAG_COOCCURRENCE_QUERY,   { id }),
        this.neo4j.read(TOP_DOMAINS_QUERY,            { id }),
        this.neo4j.read(TOP_MENTIONS_QUERY,           { id }),
        this.neo4j.read(TOP_REPLIES_QUERY,            { id }),
        this.neo4j.read(TOP_RETWEETS_QUERY,           { id }),
        this.neo4j.read(NETWORK_STATS_QUERY,          { id }),
      ]);

    // ── Post metrics ─────────────────────────────────────────────────────────
    const pm = postRes.records[0];
    const totalPosts    = pm?.get('totalPosts')?.toNumber()    ?? 0;
    const avgLikes      = pm?.get('avgLikes')    ?? 0;
    const avgRetweets   = pm?.get('avgRetweets') ?? 0;
    const avgReplies    = pm?.get('avgReplies')  ?? 0;
    const avgQuotes     = pm?.get('avgQuotes')   ?? 0;
    const originalCount  = pm?.get('originalCount')?.toNumber()  ?? 0;
    const retweetedCount = pm?.get('retweetedCount')?.toNumber() ?? 0;
    const quotedCount    = pm?.get('quotedCount')?.toNumber()    ?? 0;
    const repliedCount   = pm?.get('repliedCount')?.toNumber()   ?? 0;
    const avgEngagement  = Number(avgLikes) + Number(avgRetweets) + Number(avgReplies) + Number(avgQuotes);

    // ── Top lists ─────────────────────────────────────────────────────────────
    const topHashtags = hashtagRes.records.map((r) => ({
      tag:  r.get('tag')  as string,
      freq: (r.get('freq') as { toNumber(): number }).toNumber(),
    }));

    const hashtagCooccurrence = cooccurRes.records.map((r) => ({
      tagA:    r.get('tagA')   as string,
      tagB:    r.get('tagB')   as string,
      coFreq:  (r.get('coFreq') as { toNumber(): number }).toNumber(),
    }));

    const topDomains = domainRes.records.map((r) => ({
      domain: r.get('domain') as string,
      freq:   (r.get('freq') as { toNumber(): number }).toNumber(),
    }));

    const topMentions = mentionRes.records.map((r) => ({
      handle: r.get('handle') as string,
      freq:   (r.get('freq') as { toNumber(): number }).toNumber(),
    }));

    const topReplies = replyRes.records.map((r) => ({
      handle: r.get('handle') as string,
      freq:   (r.get('freq') as { toNumber(): number }).toNumber(),
    }));

    const topRetweets = retweetRes.records.map((r) => ({
      handle: r.get('handle') as string,
      freq:   (r.get('freq') as { toNumber(): number }).toNumber(),
    }));

    // ── Network ───────────────────────────────────────────────────────────────
    const net = networkRes.records[0];
    const followersInGraph  = net?.get('followersInGraph')?.toNumber()  ?? 0;
    const followingInGraph  = net?.get('followingInGraph')?.toNumber()  ?? 0;

    // ── Computed scores ───────────────────────────────────────────────────────
    // These need properties stored on the SocialProfile node itself
    const nodeRes = await this.neo4j.read(
      `MATCH (n:Entity { id: $id }) RETURN n.followersCount AS fc, n.followingCount AS fwc, n.accountAgeDays AS age, n.tweetsCount AS tc, n.topActiveHours AS hours, n.avgTweetsPerDay AS tpd`,
      { id },
    );
    const nr             = nodeRes.records[0];
    const followersCount = Number(nr?.get('fc')   ?? 0);
    const followingCount = Number(nr?.get('fwc')  ?? 0);
    const accountAgeDays = Number(nr?.get('age')  ?? 0);
    const tweetsCount    = Number(nr?.get('tc')   ?? 0);
    const activeHours    = (nr?.get('hours') as number[] | null) ?? [];
    const avgTweetsPerDay = Number(nr?.get('tpd') ?? 0);

    const engagementRate = followersCount > 0
      ? Math.round((avgEngagement / followersCount) * 10000) / 100   // percentage, 2 decimals
      : null;

    const amplificationRatio = totalPosts > 0
      ? Math.round((retweetedCount / totalPosts) * 100)
      : 0;

    // Authenticity score 0–100
    let authenticityScore = 50;
    if (accountAgeDays > 365)  authenticityScore += 15;
    else if (accountAgeDays < 30) authenticityScore -= 20;
    const ratio = followingCount > 0 ? followersCount / followingCount : 0;
    if (ratio >= 0.5 && ratio <= 50) authenticityScore += 10;
    else if (ratio > 500 || (ratio < 0.05 && followersCount < 100)) authenticityScore -= 15;
    if (engagementRate !== null && engagementRate >= 0.5) authenticityScore += 15;
    else if (engagementRate !== null && engagementRate < 0.05 && followersCount > 10000) authenticityScore -= 10;
    if (originalCount > 0 && totalPosts > 0 && (originalCount / totalPosts) >= 0.3) authenticityScore += 10;
    if (activeHours.length >= 6) authenticityScore += 5;
    else if (activeHours.length <= 2 && totalPosts > 20) authenticityScore -= 10;
    authenticityScore = Math.min(100, Math.max(0, authenticityScore));

    // Risk flags
    const riskFlags: string[] = [];
    if (amplificationRatio > 70)                                      riskFlags.push('high_amplification');
    if (engagementRate !== null && engagementRate < 0.05 && followersCount > 10_000) riskFlags.push('low_engagement');
    if (ratio > 200)                                                   riskFlags.push('abnormal_follower_ratio');
    if (ratio < 0.05 && followersCount < 500)                         riskFlags.push('low_follow_back_rate');
    if (accountAgeDays < 30)                                           riskFlags.push('new_account');
    if (accountAgeDays > 365 && tweetsCount < 50)                     riskFlags.push('dormant_account');
    if (activeHours.length <= 2 && totalPosts > 30)                   riskFlags.push('narrow_activity_window');
    if (avgTweetsPerDay > 50)                                         riskFlags.push('very_high_posting_frequency');

    // Estimated timezone from top active hours (rough UTC offset)
    let estimatedTimezone: string | null = null;
    if (activeHours.length > 0) {
      const peakHour = activeHours[0];
      // Most people are active 8am-10pm local → peak UTC maps to offset
      const offset  = Math.round(12 - peakHour);
      const absOff  = Math.abs(offset);
      estimatedTimezone = offset >= 0 ? `UTC+${absOff}` : `UTC-${absOff}`;
    }

    return {
      postMetrics: { totalPosts, avgLikes: Math.round(Number(avgLikes) * 10) / 10, avgRetweets: Math.round(Number(avgRetweets) * 10) / 10, avgReplies: Math.round(Number(avgReplies) * 10) / 10, avgEngagement: Math.round(avgEngagement * 10) / 10 },
      contentBreakdown: { originalCount, retweetedCount, quotedCount, repliedCount },
      engagementRate,
      amplificationRatio,
      topHashtags,
      hashtagCooccurrence,
      topDomains,
      topMentions,
      topReplies,
      topRetweets,
      networkInGraph: { followersInGraph, followingInGraph },
      authenticityScore,
      riskFlags,
      estimatedTimezone,
    };
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
