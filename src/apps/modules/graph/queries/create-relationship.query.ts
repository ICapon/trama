// Relationship type is validated against TRAMA_RELATIONSHIP_TYPE_SET before being passed here.
export function createRelationshipQuery(relationshipType: string): string {
  return `
    MATCH (from:Entity { id: $fromId })
    MATCH (to:Entity { id: $toId })
    MERGE (from)-[r:${relationshipType}]->(to)
    SET r += $properties,
        r.updatedAt = datetime()
    RETURN from, r, to
  `;
}
