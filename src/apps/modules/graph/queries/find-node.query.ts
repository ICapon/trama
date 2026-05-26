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
// Uses OPTIONAL MATCH for the direct edge so rel is a single Relationship (or null),
// not the list that [rel*1..n] variable-length paths would return.
export function findNeighborsByDepthQuery(depth: number): string {
  const d = Math.min(Math.max(1, Math.trunc(depth)), 5);
  return `
    MATCH (n:Entity { id: $id })-[*1..${d}]-(neighbor:Entity)
    OPTIONAL MATCH (n)-[rel]-(neighbor)
    RETURN DISTINCT neighbor, rel
    LIMIT 100
  `;
}

export const FIND_SHORTEST_PATH_QUERY = `
  MATCH (from:Entity { id: $fromId }), (to:Entity { id: $toId })
  MATCH p = shortestPath((from)-[*..10]-(to))
  RETURN p
`;

// Returns each root node with its direct neighbors and the connecting relationship.
// Use findGraphByNodeIds() in GraphService to deduplicate and map the results.
export const FIND_GRAPH_BY_NODE_IDS_QUERY = `
  MATCH (n:Entity) WHERE n.id IN $ids
  OPTIONAL MATCH (n)-[r]-(neighbor:Entity)
  RETURN n, r, neighbor
`;
