import { z } from 'zod';
import { TRAMA_NODE_TYPES } from '../../apps/modules/graph/const/node-categories.const';

export const CreateNodeSchema = z.object({
  type: z.enum(TRAMA_NODE_TYPES as unknown as [string, ...string[]]),
  properties: z.record(z.string(), z.any()).optional(),
});

export type CreateNodeDto = z.infer<typeof CreateNodeSchema>;
