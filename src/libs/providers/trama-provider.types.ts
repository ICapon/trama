import type { TramaNodeType, TramaRelationshipType, EntityBaseProperties, RelationshipProperties } from '../../apps/modules/graph/graph.types';

export enum TramaProviderCategory {
  IDENTITY = 'identity',
  SOCIAL = 'social',
  FINANCIAL = 'financial',
  LEGAL = 'legal',
  LOCATION = 'location',
  COMMS = 'communications',
}

export interface TramaProviderSeed {
  // Person
  firstName?: string;
  lastName?: string;
  fullName?: string;
  birthDate?: string;
  email?: string;
  username?: string;
  socialUrl?: string;
  // Organization / entity
  organization?: string;
  // Technical
  domain?: string;
  phone?: string;
  // Generic free-form query — broadest possible input for search-based providers
  query?: string;
}

export interface TramaProviderContext {
  entityId: string;
  entityType: string;
  seed: TramaProviderSeed;
  config?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface TramaProviderNodeResult {
  id: string;
  type: TramaNodeType;
  properties?: EntityBaseProperties;
}

export interface TramaProviderRelationshipResult {
  fromId: string;
  toId: string;
  type: TramaRelationshipType;
  properties?: RelationshipProperties;
}

export interface TramaProviderResult {
  nodes: TramaProviderNodeResult[];
  relationships: TramaProviderRelationshipResult[];
  rawData?: unknown;
  confidence?: number;
  sourceUrl?: string;
}

export interface TramaProviderMetadata {
  source: string;
  name: string;
  description: string;
  version: string;
  category: TramaProviderCategory;
  countries: string[];
  supportedInputs: string[];
  outputNodeTypes: TramaNodeType[];
}
