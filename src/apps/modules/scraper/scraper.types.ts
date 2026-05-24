import type { TramaNodeType } from '../graph/const/node-categories.const';
import type { TramaRelationshipType } from '../graph/const/relationship-types.const';
import type { EntityBaseProperties, RelationshipProperties } from '../graph/graph.types';

export interface ScrapeSeedData {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  birthDate?: string;
  curp?: string;
  rfc?: string;
  email?: string;
  username?: string;
  socialUrl?: string;
}

export interface ScrapeJobPayload {
  scrapeJobId: string;
  personId: string;
  source: string;
  seed: ScrapeSeedData;
}

export interface ScrapeNodeResult {
  id: string;
  type: TramaNodeType;
  properties?: EntityBaseProperties;
}

export interface ScrapeRelationshipResult {
  fromId: string;
  toId: string;
  type: TramaRelationshipType;
  properties?: RelationshipProperties;
}

export interface ScrapeProviderResult {
  nodes: ScrapeNodeResult[];
  relationships: ScrapeRelationshipResult[];
  rawData?: unknown;
}
