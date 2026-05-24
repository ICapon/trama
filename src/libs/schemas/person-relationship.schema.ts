import { z } from 'zod';
import { PERSON_RELATIONSHIP_TYPES } from '../../apps/modules/graph/const/relationship-types.const';

export const CreatePersonRelationshipSchema = z.object({
  toId: z.string().max(64),
  type: z.enum(PERSON_RELATIONSHIP_TYPES),
  relationType: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

export type CreatePersonRelationshipDto = z.infer<typeof CreatePersonRelationshipSchema>;
