import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { ProviderCredential } from './provider-credential.entity';
import type { CreateProviderCredentialDto, UpdateProviderCredentialDto } from '../../../libs/schemas/provider-credential.schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class ProviderCredentialService implements OnModuleInit {
  private readonly logger = new Logger(ProviderCredentialService.name);
  private encryptionKey!: Buffer;

  constructor(
    @InjectRepository(ProviderCredential)
    private readonly repo: Repository<ProviderCredential>,
  ) {}

  onModuleInit() {
    const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!secret) {
      this.logger.warn('CREDENTIAL_ENCRYPTION_KEY not set — provider credentials will not work correctly in production');
    }
    // Derive a 32-byte key from the secret (or a dev fallback)
    this.encryptionKey = scryptSync(secret ?? 'trama-dev-key-change-in-prod', 'trama-salt', 32) as Buffer;
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv(hex):authTag(hex):ciphertext(hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(stored: string): string {
    const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  }

  private toResponse(credential: ProviderCredential): Omit<ProviderCredential, 'encryptedValue'> & { hasValue: boolean } {
    const { encryptedValue: _, ...rest } = credential;
    return { ...rest, hasValue: !!_ };
  }

  async create(dto: CreateProviderCredentialDto) {
    const existing = await this.repo.findOneBy({ providerSource: dto.providerSource, key: dto.key });
    if (existing) {
      throw new ConflictException(`Credential "${dto.key}" already exists for provider "${dto.providerSource}"`);
    }
    const credential = this.repo.create({
      providerSource: dto.providerSource,
      key: dto.key,
      label: dto.label,
      encryptedValue: this.encrypt(dto.value),
      isActive: dto.isActive ?? true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    const saved = await this.repo.save(credential);
    return this.toResponse(saved);
  }

  async findBySource(providerSource: string) {
    const credentials = await this.repo.find({
      where: { providerSource },
      order: { key: 'ASC' },
    });
    return credentials.map((c) => this.toResponse(c));
  }

  async findAll() {
    const credentials = await this.repo.find({ order: { providerSource: 'ASC', key: 'ASC' } });
    return credentials.map((c) => this.toResponse(c));
  }

  async update(id: string, dto: UpdateProviderCredentialDto) {
    const credential = await this.repo.findOneBy({ id });
    if (!credential) throw new NotFoundException(`Credential "${id}" not found`);

    if (dto.label !== undefined) credential.label = dto.label;
    if (dto.value !== undefined) credential.encryptedValue = this.encrypt(dto.value);
    if (dto.isActive !== undefined) credential.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) credential.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const saved = await this.repo.save(credential);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const credential = await this.repo.findOneBy({ id });
    if (!credential) throw new NotFoundException(`Credential "${id}" not found`);
    await this.repo.remove(credential);
  }

  async upsert(providerSource: string, key: string, label: string, value: string): Promise<void> {
    const existing = await this.repo.findOneBy({ providerSource, key });
    if (existing) {
      existing.encryptedValue = this.encrypt(value);
      existing.label = label;
      await this.repo.save(existing);
    } else {
      const credential = this.repo.create({
        providerSource,
        key,
        label,
        encryptedValue: this.encrypt(value),
        isActive: true,
      });
      await this.repo.save(credential);
    }
  }

  async getDecryptedValue(providerSource: string, key: string): Promise<string | null> {
    const credential = await this.repo.findOneBy({ providerSource, key, isActive: true });
    if (!credential) return null;
    try {
      return this.decrypt(credential.encryptedValue);
    } catch {
      this.logger.error(`Failed to decrypt credential "${key}" for provider "${providerSource}"`);
      return null;
    }
  }
}
