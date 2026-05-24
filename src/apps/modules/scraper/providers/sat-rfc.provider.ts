import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BaseScraperProvider } from './base.provider';
import type { ScrapeSeedData, ScrapeProviderResult } from '../scraper.types';

interface SatContribuyenteResponse {
  rfc?: string;
  nombre?: string;
  situacionContribuyente?: string; // 'Activo' | 'No localizado' | 'Cancelado' | etc.
  tipo?: string; // 'Persona Física' | 'Persona Moral'
  regimenFiscal?: string[];
  [key: string]: unknown;
}

@Injectable()
export class SatRfcProvider extends BaseScraperProvider {
  readonly source = 'sat-rfc';
  readonly description = 'Consulta RFC en el SAT — validación y situación fiscal';
  private readonly logger = new Logger(SatRfcProvider.name);
  private readonly apiUrl =
    process.env.SAT_API_URL ?? 'https://apisnet.col.gob.mx/apiSAT/v1/contribuyente';

  canHandle(seed: ScrapeSeedData): boolean {
    return !!seed.rfc && this.isValidRfcFormat(seed.rfc);
  }

  async execute(personId: string, seed: ScrapeSeedData): Promise<ScrapeProviderResult> {
    const rfc = seed.rfc!.toUpperCase().trim();

    const response = await fetch(`${this.apiUrl}/${encodeURIComponent(rfc)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Trama-OSINT/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`SAT responded with status ${response.status}`);
    }

    const data = (await response.json()) as SatContribuyenteResponse;
    this.logger.debug(`SAT response for ${rfc}: ${JSON.stringify(data)}`);

    const now = new Date().toISOString();
    const rfcNodeId = randomUUID();
    const nodes: ScrapeProviderResult['nodes'] = [];
    const relationships: ScrapeProviderResult['relationships'] = [];

    // RFC node
    nodes.push({
      id: rfcNodeId,
      type: 'RFC',
      properties: {
        value: rfc,
        normalizedValue: rfc,
        name: rfc,
        description: data.tipo ?? undefined,
        confidence: 0.95,
        source: this.source,
        sourceUrl: this.apiUrl,
        createdAt: now,
      },
    });

    relationships.push({ fromId: personId, toId: rfcNodeId, type: 'HAS_RFC' });

    // TaxStatus node
    if (data.situacionContribuyente) {
      const taxStatusId = randomUUID();
      const isActive = data.situacionContribuyente.toLowerCase().includes('activo');

      nodes.push({
        id: taxStatusId,
        type: 'TaxStatus',
        properties: {
          value: data.situacionContribuyente,
          normalizedValue: data.situacionContribuyente.toLowerCase(),
          name: data.situacionContribuyente,
          status: isActive ? 'active' : 'inactive',
          description: data.regimenFiscal?.join(', ') ?? undefined,
          confidence: 0.95,
          source: this.source,
          createdAt: now,
        },
      });

      relationships.push({ fromId: rfcNodeId, toId: taxStatusId, type: 'HAS_TAX_STATUS' });
    }

    return { nodes, relationships, rawData: data };
  }

  // RFC personas físicas: 4 letras + 6 dígitos fecha + 3 homoclave = 13 chars
  // RFC personas morales: 3 letras + 6 dígitos fecha + 3 homoclave = 12 chars
  private isValidRfcFormat(rfc: string): boolean {
    return /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase().trim());
  }
}
