// Relationship type is validated before being passed here.
export function deletePersonRelationshipQuery(relationshipType: string): string {
  return `
    MATCH (from:Person { id: $fromId })-[r:${relationshipType}]->(to:Person { id: $toId })
    DELETE r
    RETURN true AS deleted
  `;
}
