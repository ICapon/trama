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

// All relationships of a node. Pass $relType = null to skip type filter.
export const FIND_NODE_RELATIONSHIPS_QUERY = `
  MATCH (n:Entity { id: $id })-[r]-(neighbor:Entity)
  WHERE $relType IS NULL OR type(r) = $relType
  RETURN n, r, neighbor
`;

export const DELETE_RELATIONSHIP_QUERY = `
  MATCH (from:Entity { id: $fromId })-[r]-(to:Entity { id: $toId })
  WHERE type(r) = $type
  DELETE r
  RETURN count(r) AS deleted
`;

export type RelDirection = 'both' | 'outgoing' | 'incoming';

// Returns all nodes within `depth` hops of any root node, plus all edges between them.
// direction controls which way to follow edges during traversal from root nodes.
// The inner OPTIONAL MATCH always returns edges in both directions between visible nodes.
export function findGraphByNodeIdsQuery(depth: number, direction: RelDirection = 'both'): string {
  const d = Math.min(Math.max(1, Math.trunc(depth)), 3);
  const hop =
    direction === 'outgoing' ? `-[*0..${d}]->` :
    direction === 'incoming' ? `<-[*0..${d}]-` :
                               `-[*0..${d}]-`;
  return `
    MATCH (root:Entity) WHERE root.id IN $ids
    MATCH (root)${hop}(node:Entity)
    WITH collect(DISTINCT node) AS allNodes
    UNWIND allNodes AS n
    OPTIONAL MATCH (n)-[r]-(neighbor:Entity)
    WHERE neighbor IN allNodes
      AND (size($relTypes) = 0 OR type(r) IN $relTypes)
    RETURN DISTINCT n, r, neighbor
    LIMIT 2000
  `;
}
