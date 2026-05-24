import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { GraphService } from './graph.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import { CreateNodeSchema, type CreateNodeDto } from '../../../libs/schemas/graph-node.schema';
import { CreateRelationshipSchema, type CreateRelationshipDto } from '../../../libs/schemas/graph-relationship.schema';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

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

  @Delete('node/:id')
  @HttpCode(204)
  removeNode(@Param('id') id: string) {
    return this.graphService.removeNode(id);
  }
}
