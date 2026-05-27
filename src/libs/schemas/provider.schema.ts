import { z } from 'zod';
import { TramaProviderCategory } from '../providers';

const categoryEnum = z.enum([
  TramaProviderCategory.IDENTITY,
  TramaProviderCategory.SOCIAL,
  TramaProviderCategory.FINANCIAL,
  TramaProviderCategory.LEGAL,
  TramaProviderCategory.LOCATION,
  TramaProviderCategory.COMMS,
]);

export const CreateProviderSchema = z.object({
  source:          z.string().min(1).max(100),
  name:            z.string().min(1).max(200),
  description:     z.string().min(1),
  category:        categoryEnum,
  countries:       z.array(z.string().length(2)).default([]),
  supportedInputs: z.array(z.string()).default([]),
  outputNodeTypes: z.array(z.string()).default([]),
  isActive:        z.boolean().default(true),
});

export const UpdateProviderSchema = z.object({
  name:            z.string().min(1).max(200).optional(),
  description:     z.string().min(1).optional(),
  category:        categoryEnum.optional(),
  countries:       z.array(z.string().length(2)).optional(),
  isActive:        z.boolean().optional(),
});

export type CreateProviderDto = z.infer<typeof CreateProviderSchema>;
export type UpdateProviderDto = z.infer<typeof UpdateProviderSchema>;
