export const NEO4J_INDEXES = [
  `
  CREATE INDEX entity_type_index IF NOT EXISTS
  FOR (n:Entity)
  ON (n.type)
  `,

  `
  CREATE INDEX entity_name_index IF NOT EXISTS
  FOR (n:Entity)
  ON (n.name)
  `,

  `
  CREATE INDEX entity_value_index IF NOT EXISTS
  FOR (n:Entity)
  ON (n.value)
  `,

  `
  CREATE INDEX entity_created_at_index IF NOT EXISTS
  FOR (n:Entity)
  ON (n.createdAt)
  `,
];