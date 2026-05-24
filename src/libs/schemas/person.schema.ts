import { z } from 'zod';

export const CreatePersonSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  secondLastName: z.string().optional(),
  birthDate: z.string().datetime({ offset: true }).optional(),
  ageEstimate: z.number().int().min(0).max(150).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  riskScore: z.number().min(0).max(100).optional(),
});

export type CreatePersonDto = z.infer<typeof CreatePersonSchema>;
