import { z } from 'zod';

export const CreateProviderCredentialSchema = z.object({
  providerSource: z.string().min(1).max(100),
  key:            z.string().min(1).max(100),
  label:          z.string().min(1).max(200),
  value:          z.string().min(1),
  isActive:       z.boolean().default(true),
  expiresAt:      z.string().datetime().optional(),
});

export const UpdateProviderCredentialSchema = z.object({
  label:     z.string().min(1).max(200).optional(),
  value:     z.string().min(1).optional(),
  isActive:  z.boolean().optional(),
  expiresAt: z.string().datetime().nullish(),
});

export type CreateProviderCredentialDto = z.infer<typeof CreateProviderCredentialSchema>;
export type UpdateProviderCredentialDto = z.infer<typeof UpdateProviderCredentialSchema>;
