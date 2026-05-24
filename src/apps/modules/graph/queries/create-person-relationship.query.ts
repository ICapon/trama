// Both node IDs are validated to be Person nodes. Type is validated before being passed here.
export function createPersonRelationshipQuery(relationshipType: string): string {
  return `
    MATCH (from:Person { id: $fromId })
    MATCH (to:Person { id: $toId })
    MERGE (from)-[r:${relationshipType}]->(to)
    SET r += $properties,
        r.updatedAt = datetime()
    RETURN from, r, to
  `;
}
