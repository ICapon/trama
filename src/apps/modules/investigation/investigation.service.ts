import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investigation, InvestigationPriority, InvestigationStatus, InvestigationViewState } from './investigation.entity';
import { GraphService } from '../graph/graph.service';
import type { TramaNodeType } from '../graph/graph.types';
import type { TramaRelationshipType } from '../graph/const/relationship-types.const';

export interface CreateInvestigationDto {
  title: string;
  description?: string;
  priority?: InvestigationPriority;
  tags?: string[];
  ownerId?: string;
}

export interface AddTargetDto {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
}

export interface UpdateInvestigationDto {
  title?: string;
  description?: string;
  status?: InvestigationStatus;
  priority?: InvestigationPriority;
  hypothesis?: string;
  tags?: string[];
}

export interface InvestigationTarget {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
}

export interface ImportBundleNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface ImportBundleEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface ImportBundle {
  version: string;
  investigation: {
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    hypothesis?: string | null;
    tags?: string[];
    viewState?: InvestigationViewState | null;
    targets: InvestigationTarget[];
  };
  graph: {
    nodes: ImportBundleNode[];
    edges: ImportBundleEdge[];
  };
}

export type InvestigationResponse = Omit<Investigation, 'targetNodeIds' | 'targetNodeLabels' | 'targetNodeTypes'> & {
  targets: InvestigationTarget[];
};

@Injectable()
export class InvestigationService {
  constructor(
    @InjectRepository(Investigation)
    private readonly repo: Repository<Investigation>,
    private readonly graphService: GraphService,
  ) {}

  private toResponse(inv: Investigation): InvestigationResponse {
    const { targetNodeIds, targetNodeLabels, targetNodeTypes, ...rest } = inv;
    return {
      ...rest,
      targets: targetNodeIds.map((nodeId, i) => ({
        nodeId,
        nodeLabel: targetNodeLabels[i] ?? '',
        nodeType: targetNodeTypes[i] ?? '',
      })),
    };
  }

  async create(dto: CreateInvestigationDto): Promise<InvestigationResponse> {
    const investigation = this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      priority: dto.priority ?? InvestigationPriority.MEDIUM,
      ownerId: dto.ownerId ?? null,
      tags: dto.tags ?? [],
    });
    return this.toResponse(await this.repo.save(investigation));
  }

  async findAll(ownerId?: string): Promise<InvestigationResponse[]> {
    const list = await this.repo.find({
      where: ownerId ? { ownerId } : {},
      order: { createdAt: 'DESC' },
    });
    return list.map((inv) => this.toResponse(inv));
  }

  async findOne(id: string): Promise<InvestigationResponse>;
  async findOne(id: string, raw: true): Promise<Investigation>;
  async findOne(id: string, raw = false): Promise<Investigation | InvestigationResponse> {
    const inv = await this.repo.findOneBy({ id });
    if (!inv) throw new NotFoundException(`Investigation ${id} not found`);
    return raw ? inv : this.toResponse(inv);
  }

  async update(id: string, dto: UpdateInvestigationDto): Promise<InvestigationResponse> {
    const inv = await this.findOne(id, true);
    Object.assign(inv, dto);
    return this.toResponse(await this.repo.save(inv));
  }

  async addTarget(id: string, dto: AddTargetDto): Promise<InvestigationResponse> {
    const inv = await this.findOne(id, true);
    if (inv.targetNodeIds.includes(dto.nodeId)) return this.toResponse(inv);
    inv.targetNodeIds = [...inv.targetNodeIds, dto.nodeId];
    inv.targetNodeLabels = [...inv.targetNodeLabels, dto.nodeLabel];
    inv.targetNodeTypes = [...inv.targetNodeTypes, dto.nodeType];
    return this.toResponse(await this.repo.save(inv));
  }

  async removeTarget(id: string, nodeId: string): Promise<InvestigationResponse> {
    const inv = await this.findOne(id, true);
    const idx = inv.targetNodeIds.indexOf(nodeId);
    if (idx === -1) return this.toResponse(inv);
    inv.targetNodeIds = inv.targetNodeIds.filter((_, i) => i !== idx);
    inv.targetNodeLabels = inv.targetNodeLabels.filter((_, i) => i !== idx);
    inv.targetNodeTypes = inv.targetNodeTypes.filter((_, i) => i !== idx);
    return this.toResponse(await this.repo.save(inv));
  }

  async updateViewState(id: string, viewState: InvestigationViewState): Promise<void> {
    await this.findOne(id, true);
    await this.repo.update(id, { viewState });
  }

  async remove(id: string): Promise<void> {
    const inv = await this.findOne(id, true);
    await this.repo.remove(inv);
  }

  async importBundle(bundle: ImportBundle): Promise<InvestigationResponse> {
    // Build old→new ID map and create all nodes
    const idMap = new Map<string, string>();
    for (const node of bundle.graph.nodes) {
      const newId = crypto.randomUUID();
      idMap.set(node.id, newId);
      // Strip system fields so they don't override the new id/timestamps
      const { id: _id, type: _type, createdAt: _ca, updatedAt: _ua, ...safeProps } = (node.properties ?? {}) as Record<string, unknown>;
      await this.graphService.createEntity({
        id: newId,
        type: node.type as TramaNodeType,
        properties: { ...safeProps, name: node.label },
      });
    }

    // Create edges using remapped IDs
    for (const edge of bundle.graph.edges) {
      const fromId = idMap.get(edge.source);
      const toId = idMap.get(edge.target);
      if (!fromId || !toId) continue;
      await this.graphService.createRelationship({
        fromId,
        toId,
        type: edge.type as TramaRelationshipType,
        properties: edge.properties,
      });
    }

    // Remap targets
    const targets = bundle.investigation.targets
      .map((t) => ({ ...t, nodeId: idMap.get(t.nodeId) ?? t.nodeId }))
      .filter((t) => idMap.has(bundle.investigation.targets.find((o) => o.nodeId === t.nodeId || idMap.get(o.nodeId) === t.nodeId)?.nodeId ?? ''));

    // Remap viewState: pinnedPositions keys and notes keys
    let viewState = bundle.investigation.viewState ?? null;
    if (viewState) {
      if (viewState.graph?.pinnedPositions) {
        const remapped: Record<string, { fx: number; fy: number; fz: number }> = {};
        for (const [oldId, pos] of Object.entries(viewState.graph.pinnedPositions)) {
          const newId = idMap.get(oldId);
          if (newId) remapped[newId] = pos;
        }
        viewState = { ...viewState, graph: { ...viewState.graph, pinnedPositions: remapped } };
      }
      if (viewState.notes) {
        const remappedNotes: Record<string, string> = {};
        for (const [oldId, note] of Object.entries(viewState.notes)) {
          const newId = idMap.get(oldId);
          if (newId) remappedNotes[newId] = note;
        }
        viewState = { ...viewState, notes: remappedNotes };
      }
      if (viewState.graph?.bookmarkedNodeIds) {
        viewState = {
          ...viewState,
          graph: {
            ...viewState.graph,
            bookmarkedNodeIds: viewState.graph.bookmarkedNodeIds
              .map((id) => idMap.get(id))
              .filter((id): id is string => !!id),
          },
        };
      }
    }

    const inv = this.repo.create({
      title: bundle.investigation.title,
      description: bundle.investigation.description ?? null,
      status: (bundle.investigation.status as InvestigationStatus) ?? InvestigationStatus.OPEN,
      priority: (bundle.investigation.priority as InvestigationPriority) ?? InvestigationPriority.MEDIUM,
      hypothesis: bundle.investigation.hypothesis ?? null,
      tags: bundle.investigation.tags ?? [],
      targetNodeIds: targets.map((t) => t.nodeId),
      targetNodeLabels: targets.map((t) => t.nodeLabel),
      targetNodeTypes: targets.map((t) => t.nodeType),
      viewState,
    });

    return this.toResponse(await this.repo.save(inv));
  }
}
