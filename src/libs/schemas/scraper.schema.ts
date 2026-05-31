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

export const DorkSearchConfigSchema = z.object({
  engine: z.enum(['auto', 'brave', 'brave-browser', 'searxng', 'ddg-browser']).optional(),
  fileTypes: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  searchMode: z.enum(['general', 'identity', 'documents']).optional(),
  maxQueries: z.number().int().min(1).max(20).optional(),
  delayMs: z.number().int().min(0).optional(),
});

export const RunScrapeSchema = z.object({
  investigationId: z.string().uuid(),
  sources: z.array(z.string()).optional(),
  seed: ScrapeSeedSchema.optional(),
  config: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export type ScrapeSeedDto = z.infer<typeof ScrapeSeedSchema>;
export type DorkSearchConfig = z.infer<typeof DorkSearchConfigSchema>;
export type RunScrapeDto = z.infer<typeof RunScrapeSchema>;
