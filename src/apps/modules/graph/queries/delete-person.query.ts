export const DELETE_PERSON_QUERY = `
  MATCH (n:Person { id: $id })
  DETACH DELETE n
  RETURN true AS deleted
`;
