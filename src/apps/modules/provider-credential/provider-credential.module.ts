import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderCredential } from './provider-credential.entity';
import { ProviderCredentialService } from './provider-credential.service';
import { ProviderCredentialController } from './provider-credential.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderCredential])],
  controllers: [ProviderCredentialController],
  providers: [ProviderCredentialService],
  exports: [ProviderCredentialService],
})
export class ProviderCredentialModule {}
