import { z } from 'zod';

const GraphFiltersSchema = z.object({
  relationshipTypes: z.array(z.string()).default([]),
});

export const CreateGraphConfigSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  filters: GraphFiltersSchema.default({ relationshipTypes: [] }),
  layout: z.enum(['force', 'radial']).default('force'),
});

export const UpdateGraphConfigSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().optional(),
  filters: GraphFiltersSchema.optional(),
  layout: z.enum(['force', 'radial']).optional(),
});

export type CreateGraphConfigDto = z.infer<typeof CreateGraphConfigSchema>;
export type UpdateGraphConfigDto = z.infer<typeof UpdateGraphConfigSchema>;
