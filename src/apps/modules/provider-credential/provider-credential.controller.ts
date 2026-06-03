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
  Query,
  UsePipes,
} from '@nestjs/common';
import { ProviderCredentialService } from './provider-credential.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import {
  CreateProviderCredentialSchema,
  UpdateProviderCredentialSchema,
} from '../../../libs/schemas/provider-credential.schema';
import type {
  CreateProviderCredentialDto,
  UpdateProviderCredentialDto,
} from '../../../libs/schemas/provider-credential.schema';

@Controller('provider-credentials')
export class ProviderCredentialController {
  constructor(private readonly service: ProviderCredentialService) {}

  @Get()
  findAll(@Query('source') source?: string) {
    if (source) return this.service.findBySource(source);
    return this.service.findAll();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateProviderCredentialSchema))
  create(@Body() dto: CreateProviderCredentialDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProviderCredentialSchema)) dto: UpdateProviderCredentialDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
