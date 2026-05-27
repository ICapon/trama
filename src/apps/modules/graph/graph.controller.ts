import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { GraphService } from './graph.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import { CreateNodeSchema, UpdateNodeSchema, type CreateNodeDto, type UpdateNodeDto } from '../../../libs/schemas/graph-node.schema';
import { CreateRelationshipSchema, type CreateRelationshipDto } from '../../../libs/schemas/graph-relationship.schema';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('node/:id')
  async getNode(@Param('id') id: string) {
    const node = await this.graphService.findEntityById(id);
    if (!node) throw new NotFoundException(`Node ${id} not found`);
    return node;
  }

  @Get('node/:id/neighbors')
  getNeighbors(
    @Param('id') id: string,
    @Query('depth') depth?: string,
  ) {
    const parsed = parseInt(depth ?? '', 10);
    const d = Number.isFinite(parsed) ? Math.min(Math.max(1, parsed), 5) : 2;
    return this.graphService.findNeighbors(id, d);
  }

  @Patch('node/:id')
  updateNode(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateNodeSchema)) dto: UpdateNodeDto,
  ) {
    return this.graphService.updateEntity(id, dto.properties);
  }

  @Post('node')
  createNode(@Body(new ZodValidationPipe(CreateNodeSchema)) dto: CreateNodeDto) {
    return this.graphService.createEntity({
      id: crypto.randomUUID(),
      type: dto.type as any,
      properties: dto.properties,
    });
  }

  @Post('relationship')
  createRelationship(@Body(new ZodValidationPipe(CreateRelationshipSchema)) dto: CreateRelationshipDto) {
    return this.graphService.createRelationship({
      fromId: dto.fromId,
      toId: dto.toId,
      type: dto.type as any,
      properties: dto.properties,
    });
  }

  @Get('node/:id/relationships')
  getRelationships(
    @Param('id') id: string,
    @Query('type') type?: string,
  ) {
    return this.graphService.findRelationships(id, type);
  }

  @Delete('relationship/:fromId/:type/:toId')
  @HttpCode(204)
  deleteRelationship(
    @Param('fromId') fromId: string,
    @Param('type') type: string,
    @Param('toId') toId: string,
  ) {
    return this.graphService.deleteRelationship(fromId, toId, type);
  }

  @Delete('node/:id')
  @HttpCode(204)
  removeNode(@Param('id') id: string) {
    return this.graphService.removeNode(id);
  }
}
