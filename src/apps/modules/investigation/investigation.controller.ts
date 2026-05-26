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

@Controller('investigations')
export class InvestigationController {
  constructor(
    private readonly service: InvestigationService,
    private readonly graphService: GraphService,
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
  async getGraph(@Param('id') id: string) {
    const inv = await this.service.findOne(id, true);
    return this.graphService.findGraphByNodeIds(inv.targetNodeIds);
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
}
