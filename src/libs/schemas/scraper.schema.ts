import { z } from 'zod';

export const ScrapeSeedSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  birthDate: z.string().optional(),
  curp: z.string().max(18).optional(),
  rfc: z.string().max(13).optional(),
  email: z.email().optional(),
  username: z.string().optional(),
  socialUrl: z.url().optional(),
});

export const RunScrapeSchema = z.object({
  investigationId: z.string().uuid(),
  sources: z.array(z.string()).optional(),
  seed: ScrapeSeedSchema.optional(),
});

export type ScrapeSeedDto = z.infer<typeof ScrapeSeedSchema>;
export type RunScrapeDto = z.infer<typeof RunScrapeSchema>;
