import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  AddTargetDto,
  CreateInvestigationDto,
  InvestigationService,
  UpdateInvestigationDto,
} from './investigation.service';
import type { InvestigationViewState } from './investigation.entity';
import { GraphService } from '../graph/graph.service';
import { GraphConfigService } from './graph-config.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import {
  CreateGraphConfigSchema,
  UpdateGraphConfigSchema,
  type CreateGraphConfigDto,
  type UpdateGraphConfigDto,
} from '../../../libs/schemas/graph-config.schema';

@Controller('investigations')
export class InvestigationController {
  constructor(
    private readonly service: InvestigationService,
    private readonly graphService: GraphService,
    private readonly graphConfigService: GraphConfigService,
  ) {}

  @Post()
  create(@Body() dto: CreateInvestigationDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('ownerId') ownerId?: string) {
    return this.service.findAll(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/graph')
  async getGraph(
    @Param('id') id: string,
    @Query('relTypes')   relTypes?:   string,
    @Query('depth')      depth?:      string,
    @Query('direction')  direction?:  string,
  ) {
    const inv = await this.service.findOne(id, true);
    const relationshipTypes = relTypes
      ? relTypes.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;
    const parsedDepth = depth ? parseInt(depth, 10) : 1;
    const parsedDirection = (direction === 'outgoing' || direction === 'incoming') ? direction : 'both';
    return this.graphService.findGraphByNodeIds(inv.targetNodeIds, {
      relationshipTypes,
      depth: parsedDepth,
      direction: parsedDirection,
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvestigationDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/targets')
  addTarget(@Param('id') id: string, @Body() dto: AddTargetDto) {
    return this.service.addTarget(id, dto);
  }

  @Delete(':id/targets/:nodeId')
  @HttpCode(HttpStatus.OK)
  removeTarget(@Param('id') id: string, @Param('nodeId') nodeId: string) {
    return this.service.removeTarget(id, nodeId);
  }

  @Patch(':id/view-state')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateViewState(@Param('id') id: string, @Body() viewState: InvestigationViewState) {
    return this.service.updateViewState(id, viewState);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Graph configs ──────────────────────────────────────────────────────────

  @Get(':id/graph-configs')
  listGraphConfigs(@Param('id') id: string) {
    return this.graphConfigService.list(id);
  }

  @Post(':id/graph-configs')
  createGraphConfig(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateGraphConfigSchema)) dto: CreateGraphConfigDto,
  ) {
    return this.graphConfigService.create(id, dto);
  }

  @Patch(':id/graph-configs/:configId')
  updateGraphConfig(
    @Param('id') id: string,
    @Param('configId') configId: string,
    @Body(new ZodValidationPipe(UpdateGraphConfigSchema)) dto: UpdateGraphConfigDto,
  ) {
    return this.graphConfigService.update(id, configId, dto);
  }

  @Delete(':id/graph-configs/:configId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGraphConfig(
    @Param('id') id: string,
    @Param('configId') configId: string,
  ) {
    return this.graphConfigService.remove(id, configId);
  }
}
