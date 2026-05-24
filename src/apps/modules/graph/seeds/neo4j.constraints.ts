export const NEO4J_CONSTRAINTS = [
  `
  CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
  FOR (n:Entity)
  REQUIRE n.id IS UNIQUE
  `,

  `
  CREATE CONSTRAINT case_id_unique IF NOT EXISTS
  FOR (n:Case)
  REQUIRE n.id IS UNIQUE
  `,

  `
  CREATE CONSTRAINT source_id_unique IF NOT EXISTS
  FOR (n:Source)
  REQUIRE n.id IS UNIQUE
  `,

  `
  CREATE CONSTRAINT evidence_id_unique IF NOT EXISTS
  FOR (n:Evidence)
  REQUIRE n.id IS UNIQUE
  `,
];