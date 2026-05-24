import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

@Controller('investigations')
export class InvestigationController {
  constructor(private readonly service: InvestigationService) {}

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
