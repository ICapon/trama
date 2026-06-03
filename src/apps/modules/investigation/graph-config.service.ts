import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphConfig } from './graph-config.entity';
import type { CreateGraphConfigDto, UpdateGraphConfigDto } from '../../../libs/schemas/graph-config.schema';

@Injectable()
export class GraphConfigService {
  constructor(
    @InjectRepository(GraphConfig)
    private readonly repo: Repository<GraphConfig>,
  ) {}

  async list(investigationId: string): Promise<GraphConfig[]> {
    return this.repo.find({
      where: { investigationId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(investigationId: string, dto: CreateGraphConfigDto): Promise<GraphConfig> {
    const exists = await this.repo.findOne({
      where: { investigationId, name: dto.name },
    });
    if (exists) {
      throw new ConflictException(
        `A configuration named "${dto.name}" already exists for this investigation`,
      );
    }

    const config = this.repo.create({
      investigationId,
      name: dto.name,
      description: dto.description ?? null,
      filters: dto.filters,
      layout: dto.layout,
    });
    return this.repo.save(config);
  }

  async update(investigationId: string, id: string, dto: UpdateGraphConfigDto): Promise<GraphConfig> {
    const config = await this.findOne(investigationId, id);

    if (dto.name && dto.name !== config.name) {
      const conflict = await this.repo.findOne({
        where: { investigationId, name: dto.name },
      });
      if (conflict) {
        throw new ConflictException(
          `A configuration named "${dto.name}" already exists for this investigation`,
        );
      }
    }

    if (dto.name !== undefined) config.name = dto.name;
    if (dto.description !== undefined) config.description = dto.description ?? null;
    if (dto.filters !== undefined) config.filters = { ...config.filters, ...dto.filters };
    if (dto.layout !== undefined) config.layout = dto.layout;

    return this.repo.save(config);
  }

  async remove(investigationId: string, id: string): Promise<void> {
    const config = await this.findOne(investigationId, id);
    await this.repo.remove(config);
  }

  private async findOne(investigationId: string, id: string): Promise<GraphConfig> {
    const config = await this.repo.findOne({ where: { id, investigationId } });
    if (!config) throw new NotFoundException(`Graph config ${id} not found`);
    return config;
  }
}
