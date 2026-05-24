import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investigation, InvestigationPriority, InvestigationStatus } from './investigation.entity';

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

@Injectable()
export class InvestigationService {
  constructor(
    @InjectRepository(Investigation)
    private readonly repo: Repository<Investigation>,
  ) {}

  async create(dto: CreateInvestigationDto): Promise<Investigation> {
    const investigation = this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      priority: dto.priority ?? InvestigationPriority.MEDIUM,
      ownerId: dto.ownerId ?? null,
      tags: dto.tags ?? [],
    });
    return this.repo.save(investigation);
  }

  async findAll(ownerId?: string): Promise<Investigation[]> {
    return this.repo.find({
      where: ownerId ? { ownerId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Investigation> {
    const inv = await this.repo.findOneBy({ id });
    if (!inv) throw new NotFoundException(`Investigation ${id} not found`);
    return inv;
  }

  async update(id: string, dto: UpdateInvestigationDto): Promise<Investigation> {
    const inv = await this.findOne(id);
    Object.assign(inv, dto);
    return this.repo.save(inv);
  }

  async addTarget(id: string, dto: AddTargetDto): Promise<Investigation> {
    const inv = await this.findOne(id);
    if (inv.targetNodeIds.includes(dto.nodeId)) return inv;
    inv.targetNodeIds = [...inv.targetNodeIds, dto.nodeId];
    inv.targetNodeLabels = [...inv.targetNodeLabels, dto.nodeLabel];
    inv.targetNodeTypes = [...inv.targetNodeTypes, dto.nodeType];
    return this.repo.save(inv);
  }

  async removeTarget(id: string, nodeId: string): Promise<Investigation> {
    const inv = await this.findOne(id);
    const idx = inv.targetNodeIds.indexOf(nodeId);
    if (idx === -1) return inv;
    inv.targetNodeIds = inv.targetNodeIds.filter((_, i) => i !== idx);
    inv.targetNodeLabels = inv.targetNodeLabels.filter((_, i) => i !== idx);
    inv.targetNodeTypes = inv.targetNodeTypes.filter((_, i) => i !== idx);
    return this.repo.save(inv);
  }

  async remove(id: string): Promise<void> {
    const inv = await this.findOne(id);
    await this.repo.remove(inv);
  }
}
