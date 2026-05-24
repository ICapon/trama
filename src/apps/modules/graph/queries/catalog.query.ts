export const CREATE_CATEGORY_QUERY = `
  MERGE (c:Category { name: $name })
  SET c.updatedAt = datetime()
  RETURN c
`;

export const CREATE_NODE_TYPE_QUERY = `
  MERGE (n:NodeType { name: $name })
  SET n.category = $category,
      n.properties = $properties,
      n.updatedAt = datetime()
  RETURN n
`;

export const CREATE_RELATIONSHIP_TYPE_QUERY = `
  MERGE (r:RelationshipType { name: $name })
  SET r.updatedAt = datetime()
  RETURN r
`;

// Combined: creates Category + NodeType and links them in a single transaction.
export const SEED_CATEGORY_AND_NODE_TYPE_QUERY = `
  MERGE (c:Category { name: $category })
  SET c.updatedAt = datetime()
  WITH c
  MERGE (n:NodeType { name: $nodeType })
  SET n.category = $category,
      n.properties = $properties,
      n.updatedAt = datetime()
  MERGE (c)-[:HAS_NODE_TYPE]->(n)
`;
