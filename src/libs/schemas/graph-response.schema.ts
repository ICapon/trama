import { z } from 'zod';
import {
  GraphEdgeResponseSchema,
  GraphNodeResponseSchema,
} from './graph-node-response.schema';

export const GraphResponseSchema = z.object({
  nodes: z.array(GraphNodeResponseSchema),
  edges: z.array(GraphEdgeResponseSchema),
});

export type GraphResponse = z.infer<typeof GraphResponseSchema>;
