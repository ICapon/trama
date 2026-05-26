import type { TramaProviderSeed } from '../trama-provider.types';

export interface MxIdentifiers {
  curp?: string;
  rfc?: string;
}

export type MxSeed = TramaProviderSeed & MxIdentifiers;
