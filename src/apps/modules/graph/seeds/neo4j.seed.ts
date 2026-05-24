import { TRAMA_NODE_CATEGORIES } from '../const/node-categories.const';
import { TRAMA_NODE_PROPERTIES } from '../const/node-properties.const';
import { TRAMA_RELATIONSHIP_TYPES } from '../const/relationship-types.const';
import { SEED_CATEGORY_AND_NODE_TYPE_QUERY } from '../queries/catalog.query';

export interface SeedQuery {
  query: string;
  params: Record<string, unknown>;
}

export function getNodeCategorySeedQueries(): SeedQuery[] {
  const queries: SeedQuery[] = [];

  for (const [category, nodeTypes] of Object.entries(TRAMA_NODE_CATEGORIES)) {
    for (const nodeType of nodeTypes) {
      queries.push({
        query: SEED_CATEGORY_AND_NODE_TYPE_QUERY,
        params: {
          category,
          nodeType,
          properties: TRAMA_NODE_PROPERTIES[nodeType as keyof typeof TRAMA_NODE_PROPERTIES] ?? [],
        },
      });
    }
  }

  return queries;
}

export function getRelationshipTypeSeedQueries(): SeedQuery[] {
  return TRAMA_RELATIONSHIP_TYPES.map((name) => ({
    query: `
      MERGE (r:RelationshipType { name: $name })
      SET r.updatedAt = datetime()
    `,
    params: { name },
  }));
}
