import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TramaProvider, TramaProviderCategory } from '../../../../libs/providers';
import type { TramaProviderContext, TramaProviderResult, TramaProviderSeed, TramaNodeType, MxSeed } from '../../../../libs/providers';

interface RenapoResponse {
  curp?: string;
  nombres?: string;
  primerApellido?: string;
  segundoApellido?: string;
  sexo?: string;
  fechaNacimiento?: string; // DD/MM/YYYY
  entidadNacimiento?: string;
  nacionalidad?: string;
  statusCurp?: string; // 'AN' = activo, 'BA' = baja
  [key: string]: unknown;
}

// Códigos de entidad federativa codificados en el CURP (posiciones 11-12)
const CURP_STATE_CODES: Record<string, string> = {
  AS: 'Aguascalientes', BC: 'Baja California', BS: 'Baja California Sur',
  CC: 'Campeche', CL: 'Coahuila', CM: 'Colima', CS: 'Chiapas', CH: 'Chihuahua',
  DF: 'Ciudad de México', DG: 'Durango', GT: 'Guanajuato', GR: 'Guerrero',
  HG: 'Hidalgo', JC: 'Jalisco', MC: 'Estado de México', MN: 'Michoacán',
  MS: 'Morelos', NT: 'Nayarit', NL: 'Nuevo León', OC: 'Oaxaca', PL: 'Puebla',
  QT: 'Querétaro', QR: 'Quintana Roo', SP: 'San Luis Potosí', SL: 'Sinaloa',
  SR: 'Sonora', TC: 'Tabasco', TS: 'Tamaulipas', TL: 'Tlaxcala',
  VZ: 'Veracruz', YN: 'Yucatán', ZS: 'Zacatecas', NE: 'Extranjero',
};

const GENDER_MAP: Record<string, string> = { H: 'male', M: 'female' };

@Injectable()
export class CurpProvider extends TramaProvider {
  readonly source = 'curp-renapo';
  readonly name = 'CURP / RENAPO';
  readonly description = 'Decodifica CURP localmente + intenta enriquecer vía RENAPO';
  readonly category = TramaProviderCategory.IDENTITY;
  readonly countries = ['MX'];
  readonly supportedInputs: string[] = ['curp'];
  readonly outputNodeTypes: TramaNodeType[] = ['CURP', 'Address'];

  private readonly logger = new Logger(CurpProvider.name);
  private readonly apiUrl =
    process.env.RENAPO_API_URL ?? 'https://consultas.curp.gob.mx/CurpSP/gobmx/curp';

  canHandle(seed: TramaProviderSeed): boolean {
    const { curp } = seed as MxSeed;
    return !!curp && /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/.test(curp.toUpperCase().trim());
  }

  // Decodifica los campos que el CURP lleva codificados en su estructura.
  // Esto siempre funciona sin llamadas externas.
  private decodeCurp(curp: string): Partial<RenapoResponse> {
    const yy = curp.substring(4, 6);
    const mm = curp.substring(6, 8);
    const dd = curp.substring(8, 10);
    const genderChar = curp[10];
    const stateCode = curp.substring(11, 13);
    // Dígito de siglo: '0'–'9' → 1900s, 'A'–'Z' → 2000s
    const centuryDigit = curp[16];
    const century = /[A-Z]/.test(centuryDigit) ? '20' : '19';

    return {
      sexo: genderChar,
      fechaNacimiento: `${dd}/${mm}/${century}${yy}`,
      entidadNacimiento: CURP_STATE_CODES[stateCode] ?? stateCode,
    };
  }

  // Intenta obtener nombre completo desde RENAPO. Si falla, retorna null silenciosamente.
  private async fetchRenapo(curp: string): Promise<RenapoResponse | null> {
    try {
      const session = await fetch('https://consultas.curp.gob.mx/CurpSP/', {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      });
      const cookie = session.headers.get('set-cookie')?.split(';')[0]?.trim() ?? '';

      const res = await fetch(`${this.apiUrl}?curp=${encodeURIComponent(curp)}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0',
          Origin: 'https://www.gob.mx',
          Referer: 'https://www.gob.mx/curp/',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });

      if (!res.ok) {
        this.logger.warn(`RENAPO API no disponible (${res.status}) — usando solo decodificación local`);
        return null;
      }

      return res.json() as Promise<RenapoResponse>;
    } catch (err) {
      this.logger.warn(`RENAPO fetch falló — usando solo decodificación local: ${String(err)}`);
      return null;
    }
  }

  async execute(ctx: TramaProviderContext): Promise<TramaProviderResult> {
    const { entityId } = ctx;
    const seed = ctx.seed as MxSeed;
    const curp = seed.curp!.toUpperCase().trim();
    const now = new Date().toISOString();

    const decoded = this.decodeCurp(curp);
    const remote = await this.fetchRenapo(curp);

    // Remote tiene precedencia cuando está disponible
    const data: Partial<RenapoResponse> = { ...decoded, ...remote };
    this.logger.debug(`CURP data para ${curp}: ${JSON.stringify(data)}`);

    const curpNodeId = randomUUID();
    const nodes: TramaProviderResult['nodes'] = [];
    const relationships: TramaProviderResult['relationships'] = [];

    const enriched: Record<string, unknown> = {};
    if (data.nombres) enriched['firstName'] = data.nombres;
    if (data.primerApellido) enriched['lastName'] = data.primerApellido;
    if (data.segundoApellido) enriched['secondLastName'] = data.segundoApellido;
    if (data.sexo) enriched['gender'] = GENDER_MAP[data.sexo] ?? 'unknown';
    if (data.nacionalidad) enriched['nationality'] = data.nacionalidad;
    if (data.fechaNacimiento) {
      const [day, month, year] = data.fechaNacimiento.split('/');
      enriched['birthDate'] = `${year}-${month}-${day}`;
    }

    nodes.push({
      id: curpNodeId,
      type: 'CURP',
      properties: {
        value: curp,
        normalizedValue: curp,
        name: curp,
        scrapeStatus: data.statusCurp ?? 'decoded',
        confidence: remote ? 0.95 : 0.75,
        source: this.source,
        createdAt: now,
        ...enriched,
      },
    });

    relationships.push({ fromId: entityId, toId: curpNodeId, type: 'HAS_CURP' });

    if (data.entidadNacimiento) {
      const addressId = randomUUID();
      nodes.push({
        id: addressId,
        type: 'Address',
        properties: {
          value: data.entidadNacimiento,
          normalizedValue: data.entidadNacimiento.toLowerCase(),
          name: data.entidadNacimiento,
          description: 'Entidad de nacimiento',
          confidence: 0.9,
          source: this.source,
          createdAt: now,
        },
      });
      relationships.push({ fromId: entityId, toId: addressId, type: 'LIVES_AT' });
    }

    return { nodes, relationships, rawData: data };
  }
}
