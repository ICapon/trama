import { z } from 'zod';
import { TRAMA_RELATIONSHIP_TYPES } from '../../apps/modules/graph/const/relationship-types.const';

export const CreateRelationshipSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  type: z.enum(TRAMA_RELATIONSHIP_TYPES as unknown as [string, ...string[]]),
  properties: z.record(z.string(), z.any()).optional(),
});

export type CreateRelationshipDto = z.infer<typeof CreateRelationshipSchema>;
