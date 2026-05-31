import { z } from 'zod';
import { ScrapeSeedSchema } from './scraper.schema';

export const CreateCronJobSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  cronExpression: z.string().min(1),
  source: z.string().min(1),
  entityId: z.string().min(1),
  investigationId: z.string().uuid(),
  seed: ScrapeSeedSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateCronJobSchema = CreateCronJobSchema.partial();

export type CreateCronJobDto = z.infer<typeof CreateCronJobSchema>;
export type UpdateCronJobDto = z.infer<typeof UpdateCronJobSchema>;
