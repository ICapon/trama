// Replaces all properties with $properties, preserving id/type/createdAt.
export const UPDATE_NODE_QUERY = `
  MATCH (n:Entity { id: $id })
  WITH n, n.type AS nodeType, n.createdAt AS createdAt
  SET n = $properties,
      n.id        = $id,
      n.type      = nodeType,
      n.createdAt = createdAt,
      n.updatedAt = $updatedAt
  RETURN n
`;
