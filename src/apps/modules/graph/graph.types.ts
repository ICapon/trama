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
