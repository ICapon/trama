import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { Upload } from './upload.entity';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(Upload)
    private readonly repo: Repository<Upload>,
  ) {}

  save(file: Express.Multer.File, baseUrl: string, uploadedBy?: string): Promise<Upload> {
    const upload = this.repo.create({
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      url: `${baseUrl}/files/${file.filename}`,
      uploadedBy: uploadedBy ?? null,
    });
    return this.repo.save(upload);
  }

  findAll(): Promise<Upload[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Upload> {
    const upload = await this.repo.findOneBy({ id });
    if (!upload) throw new NotFoundException(`Upload ${id} not found`);
    return upload;
  }

  async remove(id: string): Promise<void> {
    const upload = await this.findOne(id);
    await unlink(upload.path).catch(() => null);
    await this.repo.remove(upload);
  }
}
