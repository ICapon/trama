import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investigation, InvestigationPriority, InvestigationStatus, InvestigationViewState } from './investigation.entity';

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

export type InvestigationResponse = Omit<Investigation, 'targetNodeIds' | 'targetNodeLabels' | 'targetNodeTypes'> & {
  targets: InvestigationTarget[];
};

@Injectable()
export class InvestigationService {
  constructor(
    @InjectRepository(Investigation)
    private readonly repo: Repository<Investigation>,
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
}
