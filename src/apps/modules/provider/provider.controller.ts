import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import { CreateProviderSchema, UpdateProviderSchema } from '../../../libs/schemas/provider.schema';
import type { CreateProviderDto, UpdateProviderDto } from '../../../libs/schemas/provider.schema';

@Controller('providers')
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Get()
  findAll() {
    return this.providerService.findAll();
  }

  @Get(':source')
  async findOne(@Param('source') source: string) {
    const provider = await this.providerService.findBySource(source);
    if (!provider) throw new NotFoundException(`Provider "${source}" not found`);
    return provider;
  }

  @Patch(':source/active')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setActive(
    @Param('source') source: string,
    @Body('isActive') isActive: boolean,
  ) {
    const provider = await this.providerService.findBySource(source);
    if (!provider) throw new NotFoundException(`Provider "${source}" not found`);
    await this.providerService.setActive(source, isActive);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateProviderSchema))
  create(@Body() dto: CreateProviderDto) {
    return this.providerService.create(dto);
  }

  @Patch(':source')
  async update(
    @Param('source') source: string,
    @Body(new ZodValidationPipe(UpdateProviderSchema)) dto: UpdateProviderDto,
  ) {
    return this.providerService.update(source, dto);
  }

  @Delete(':source')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('source') source: string) {
    await this.providerService.remove(source);
  }

  @Get(':source/runs')
  async findRuns(
    @Param('source') source: string,
    @Query('limit') limit?: string,
  ) {
    const provider = await this.providerService.findBySource(source);
    if (!provider) throw new NotFoundException(`Provider "${source}" not found`);
    return this.providerService.findRunsBySource(source, limit ? parseInt(limit, 10) : undefined);
  }
}
