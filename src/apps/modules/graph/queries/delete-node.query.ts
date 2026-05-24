export const DELETE_NODE_QUERY = `
  MATCH (n:Entity { id: $id })
  DETACH DELETE n
  RETURN true AS deleted
`;
