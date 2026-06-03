import type { TramaNodeCategory, TramaNodeType } from './const/node-categories.const';
import type { TramaRelationshipType } from './const/relationship-types.const';

export type { TramaNodeCategory, TramaNodeType, TramaRelationshipType };

export interface EntityBaseProperties {
  id?: string;
  type?: string;
  name?: string;
  value?: string;
  normalizedValue?: string;
  description?: string;
  source?: string;
  sourceUrl?: string;
  sourceId?: string;
  confidence?: number;
  riskScore?: number;
  tags?: string[];
  status?: 'active' | 'inactive' | 'unknown' | 'archived';
  visibility?: 'private' | 'team' | 'public';
  createdAt?: string;
  updatedAt?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  [key: string]: unknown;
}

export interface RelationshipProperties {
  id?: string;
  sourceId?: string;
  evidenceId?: string;
  confidence?: number;
  weight?: number;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface CreateEntityInput {
  id: string;
  type: TramaNodeType;
  properties?: EntityBaseProperties;
}

export interface CreateRelationshipInput {
  fromId: string;
  toId: string;
  type: TramaRelationshipType;
  properties?: RelationshipProperties;
}

export type RelDirection = 'both' | 'outgoing' | 'incoming';

/** Extensible filter object passed to graph queries. */
export interface GraphFilters {
  /** Only return edges of these relationship types. Empty / undefined = no filter. */
  relationshipTypes?: string[];
  /** How many hops to expand from the root nodes. Clamped to 1–3. Default: 1. */
  depth?: number;
  /** Direction to follow when expanding from root nodes. Default: 'both'. */
  direction?: RelDirection;
}
