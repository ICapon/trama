import { z } from 'zod';
import {
  TRAMA_NODE_CATEGORIES,
  TRAMA_NODE_TYPES,
} from '../../apps/modules/graph/const/node-categories.const';
import { TRAMA_RELATIONSHIP_TYPES } from '../../apps/modules/graph/const/relationship-types.const';

const NODE_CATEGORY_KEYS = Object.keys(TRAMA_NODE_CATEGORIES) as [
  keyof typeof TRAMA_NODE_CATEGORIES,
  ...Array<keyof typeof TRAMA_NODE_CATEGORIES>,
];

export const GraphNodeResponseSchema = z.object({
  id: z.string(),
  type: z.enum(TRAMA_NODE_TYPES as unknown as [string, ...string[]]),
  category: z.enum(NODE_CATEGORY_KEYS),
  label: z.string(),
  properties: z.record(z.string(), z.unknown()),
  uploadUrl: z.string().url().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const GraphEdgeResponseSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(TRAMA_RELATIONSHIP_TYPES as unknown as [string, ...string[]]),
  label: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export type GraphNodeResponse = z.infer<typeof GraphNodeResponseSchema>;
export type GraphEdgeResponse = z.infer<typeof GraphEdgeResponseSchema>;
