export const FIND_ENTITY_BY_ID_QUERY = `
  MATCH (n:Entity { id: $id })
  RETURN n
`;

export const FIND_ENTITIES_BY_TYPE_QUERY = `
  MATCH (n:Entity { type: $type })
  RETURN n
  ORDER BY n.createdAt DESC
`;

export const FIND_ENTITIES_BY_VALUE_QUERY = `
  MATCH (n:Entity { normalizedValue: $normalizedValue })
  RETURN n
`;

// Uses the fulltext index created in neo4j.indexes.ts.
export const SEARCH_ENTITIES_BY_TEXT_QUERY = `
  CALL db.index.fulltext.queryNodes('entity_fulltext_index', $text)
  YIELD node AS n, score
  RETURN n, score
  ORDER BY score DESC
  LIMIT $limit
`;

// Direct neighbors (depth 1). For deeper traversal use findNeighborsByDepthQuery().
export const FIND_NEIGHBORS_QUERY = `
  MATCH (n:Entity { id: $id })-[rel]-(neighbor:Entity)
  RETURN neighbor, rel
  LIMIT 100
`;

// Depth is clamped 1–5 and interpolated as a safe integer by GraphService.
export function findNeighborsByDepthQuery(depth: number): string {
  const d = Math.min(Math.max(1, Math.trunc(depth)), 5);
  return `
    MATCH (n:Entity { id: $id })-[rel*1..${d}]-(neighbor:Entity)
    RETURN DISTINCT neighbor, rel
    LIMIT 100
  `;
}

export const FIND_SHORTEST_PATH_QUERY = `
  MATCH (from:Entity { id: $fromId }), (to:Entity { id: $toId })
  MATCH p = shortestPath((from)-[*..10]-(to))
  RETURN p
`;
