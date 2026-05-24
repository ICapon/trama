// Labels are validated against TRAMA_NODE_TYPE_SET before being passed here.
export function createEntityNodeQuery(label: string): string {
  return `
    MERGE (n:Entity:${label} { id: $id })
    SET n += $properties,
        n.type = $type,
        n.updatedAt = datetime()
    RETURN n
  `;
}

// Use when only the :Entity label is needed (no specific sub-label).
export const CREATE_ENTITY_NODE_QUERY = `
  MERGE (n:Entity { id: $id })
  SET n += $properties,
      n.type = $type,
      n.updatedAt = datetime()
  RETURN n
`;
