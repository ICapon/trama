import type {
  TramaProviderCategory,
  TramaProviderContext,
  TramaProviderMetadata,
  TramaProviderResult,
  TramaProviderSeed,
} from './trama-provider.types';
import type { TramaNodeType } from '../../apps/modules/graph/graph.types';

export abstract class TramaProvider {
  abstract readonly source: string;
  abstract readonly name: string;
  abstract readonly description: string;
  readonly version: string = '1.0.0';
  abstract readonly category: TramaProviderCategory;
  readonly countries: string[] = [];
  abstract readonly supportedInputs: string[];
  abstract readonly outputNodeTypes: TramaNodeType[];

  abstract canHandle(seed: TramaProviderSeed): boolean;
  abstract execute(ctx: TramaProviderContext): Promise<TramaProviderResult>;

  getMetadata(): TramaProviderMetadata {
    return {
      source: this.source,
      name: this.name,
      description: this.description,
      version: this.version,
      category: this.category,
      countries: this.countries,
      supportedInputs: this.supportedInputs,
      outputNodeTypes: this.outputNodeTypes,
    };
  }
}
