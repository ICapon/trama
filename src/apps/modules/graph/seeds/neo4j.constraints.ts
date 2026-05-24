export const NEO4J_CONSTRAINTS: string[] = [
  // Core entity uniqueness
  `CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
   FOR (n:Entity) REQUIRE n.id IS UNIQUE`,

  // Catalog nodes
  `CREATE CONSTRAINT node_type_name_unique IF NOT EXISTS
   FOR (n:NodeType) REQUIRE n.name IS UNIQUE`,

  `CREATE CONSTRAINT relationship_type_name_unique IF NOT EXISTS
   FOR (n:RelationshipType) REQUIRE n.name IS UNIQUE`,

  `CREATE CONSTRAINT category_name_unique IF NOT EXISTS
   FOR (n:Category) REQUIRE n.name IS UNIQUE`,

  // Domain-specific uniqueness
  `CREATE CONSTRAINT source_id_unique IF NOT EXISTS
   FOR (n:Source) REQUIRE n.id IS UNIQUE`,

  `CREATE CONSTRAINT evidence_id_unique IF NOT EXISTS
   FOR (n:Evidence) REQUIRE n.id IS UNIQUE`,

  `CREATE CONSTRAINT case_id_unique IF NOT EXISTS
   FOR (n:Case) REQUIRE n.id IS UNIQUE`,

  `CREATE CONSTRAINT investigation_id_unique IF NOT EXISTS
   FOR (n:Investigation) REQUIRE n.id IS UNIQUE`,

  `CREATE CONSTRAINT dataset_id_unique IF NOT EXISTS
   FOR (n:Dataset) REQUIRE n.id IS UNIQUE`,

  // File hashes (only enforced when property exists)
  `CREATE CONSTRAINT file_hash_unique IF NOT EXISTS
   FOR (n:File) REQUIRE n.hashSha256 IS UNIQUE`,

  `CREATE CONSTRAINT document_hash_unique IF NOT EXISTS
   FOR (n:Document) REQUIRE n.hashSha256 IS UNIQUE`,

  `CREATE CONSTRAINT image_hash_unique IF NOT EXISTS
   FOR (n:Image) REQUIRE n.hashSha256 IS UNIQUE`,

  `CREATE CONSTRAINT video_hash_unique IF NOT EXISTS
   FOR (n:Video) REQUIRE n.hashSha256 IS UNIQUE`,

  // Crypto
  `CREATE CONSTRAINT ssl_fingerprint_unique IF NOT EXISTS
   FOR (n:SSLCertificate) REQUIRE n.fingerprintSha256 IS UNIQUE`,

  `CREATE CONSTRAINT crypto_tx_hash_unique IF NOT EXISTS
   FOR (n:CryptoTransaction) REQUIRE n.txHash IS UNIQUE`,
];
