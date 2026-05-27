import { z } from 'zod';
import { TRAMA_NODE_TYPES } from '../../apps/modules/graph/const/node-categories.const';

export const CreateNodeSchema = z.object({
  type: z.enum(TRAMA_NODE_TYPES as unknown as [string, ...string[]]),
  properties: z.record(z.string(), z.any()).optional(),
});

export const UpdateNodeSchema = z.object({
  properties: z.record(z.string(), z.any()).refine((v) => Object.keys(v).length > 0, { message: 'properties must not be empty' }),
});

export type CreateNodeDto = z.infer<typeof CreateNodeSchema>;
export type UpdateNodeDto = z.infer<typeof UpdateNodeSchema>;
