export const NEO4J_INDEXES: string[] = [
  // Entity base
  `CREATE INDEX entity_type_index IF NOT EXISTS FOR (n:Entity) ON (n.type)`,
  `CREATE INDEX entity_name_index IF NOT EXISTS FOR (n:Entity) ON (n.name)`,
  `CREATE INDEX entity_value_index IF NOT EXISTS FOR (n:Entity) ON (n.value)`,
  `CREATE INDEX entity_normalized_value_index IF NOT EXISTS FOR (n:Entity) ON (n.normalizedValue)`,
  `CREATE INDEX entity_created_at_index IF NOT EXISTS FOR (n:Entity) ON (n.createdAt)`,
  `CREATE INDEX entity_updated_at_index IF NOT EXISTS FOR (n:Entity) ON (n.updatedAt)`,
  `CREATE INDEX entity_first_seen_at_index IF NOT EXISTS FOR (n:Entity) ON (n.firstSeenAt)`,
  `CREATE INDEX entity_last_seen_at_index IF NOT EXISTS FOR (n:Entity) ON (n.lastSeenAt)`,
  `CREATE INDEX entity_confidence_index IF NOT EXISTS FOR (n:Entity) ON (n.confidence)`,
  `CREATE INDEX entity_risk_score_index IF NOT EXISTS FOR (n:Entity) ON (n.riskScore)`,
  `CREATE INDEX entity_status_index IF NOT EXISTS FOR (n:Entity) ON (n.status)`,

  // Person
  `CREATE INDEX person_name_index IF NOT EXISTS FOR (n:Person) ON (n.name)`,
  `CREATE INDEX person_full_name_index IF NOT EXISTS FOR (n:Person) ON (n.fullName)`,
  `CREATE INDEX person_normalized_value_index IF NOT EXISTS FOR (n:Person) ON (n.normalizedValue)`,

  // Company
  `CREATE INDEX company_name_index IF NOT EXISTS FOR (n:Company) ON (n.name)`,
  `CREATE INDEX company_legal_name_index IF NOT EXISTS FOR (n:Company) ON (n.legalName)`,
  `CREATE INDEX company_normalized_name_index IF NOT EXISTS FOR (n:Company) ON (n.normalizedName)`,
  `CREATE INDEX company_rfc_index IF NOT EXISTS FOR (n:Company) ON (n.rfc)`,

  // Email
  `CREATE INDEX email_value_index IF NOT EXISTS FOR (n:Email) ON (n.value)`,
  `CREATE INDEX email_normalized_value_index IF NOT EXISTS FOR (n:Email) ON (n.normalizedValue)`,
  `CREATE INDEX email_domain_index IF NOT EXISTS FOR (n:Email) ON (n.domain)`,

  // PhoneNumber
  `CREATE INDEX phone_value_index IF NOT EXISTS FOR (n:PhoneNumber) ON (n.value)`,
  `CREATE INDEX phone_normalized_value_index IF NOT EXISTS FOR (n:PhoneNumber) ON (n.normalizedValue)`,

  // Username
  `CREATE INDEX username_value_index IF NOT EXISTS FOR (n:Username) ON (n.value)`,
  `CREATE INDEX username_normalized_value_index IF NOT EXISTS FOR (n:Username) ON (n.normalizedValue)`,
  `CREATE INDEX username_platform_index IF NOT EXISTS FOR (n:Username) ON (n.platform)`,

  // SocialProfile
  `CREATE INDEX social_profile_platform_index IF NOT EXISTS FOR (n:SocialProfile) ON (n.platform)`,
  `CREATE INDEX social_profile_username_index IF NOT EXISTS FOR (n:SocialProfile) ON (n.username)`,
  `CREATE INDEX social_profile_url_index IF NOT EXISTS FOR (n:SocialProfile) ON (n.url)`,

  // Domain
  `CREATE INDEX domain_value_index IF NOT EXISTS FOR (n:Domain) ON (n.value)`,
  `CREATE INDEX domain_normalized_value_index IF NOT EXISTS FOR (n:Domain) ON (n.normalizedValue)`,
  `CREATE INDEX domain_name_index IF NOT EXISTS FOR (n:Domain) ON (n.domainName)`,
  `CREATE INDEX domain_tld_index IF NOT EXISTS FOR (n:Domain) ON (n.tld)`,

  // Subdomain
  `CREATE INDEX subdomain_value_index IF NOT EXISTS FOR (n:Subdomain) ON (n.value)`,
  `CREATE INDEX subdomain_normalized_value_index IF NOT EXISTS FOR (n:Subdomain) ON (n.normalizedValue)`,
  `CREATE INDEX subdomain_root_domain_index IF NOT EXISTS FOR (n:Subdomain) ON (n.rootDomain)`,

  // URL
  `CREATE INDEX url_value_index IF NOT EXISTS FOR (n:URL) ON (n.value)`,
  `CREATE INDEX url_normalized_value_index IF NOT EXISTS FOR (n:URL) ON (n.normalizedValue)`,
  `CREATE INDEX url_host_index IF NOT EXISTS FOR (n:URL) ON (n.host)`,

  // IPAddress
  `CREATE INDEX ip_value_index IF NOT EXISTS FOR (n:IPAddress) ON (n.value)`,
  `CREATE INDEX ip_normalized_value_index IF NOT EXISTS FOR (n:IPAddress) ON (n.normalizedValue)`,
  `CREATE INDEX ip_asn_index IF NOT EXISTS FOR (n:IPAddress) ON (n.asn)`,

  // RFC / CURP
  `CREATE INDEX rfc_value_index IF NOT EXISTS FOR (n:RFC) ON (n.value)`,
  `CREATE INDEX rfc_normalized_value_index IF NOT EXISTS FOR (n:RFC) ON (n.normalizedValue)`,
  `CREATE INDEX curp_value_index IF NOT EXISTS FOR (n:CURP) ON (n.value)`,
  `CREATE INDEX curp_normalized_value_index IF NOT EXISTS FOR (n:CURP) ON (n.normalizedValue)`,

  // Vehicle
  `CREATE INDEX vehicle_vin_index IF NOT EXISTS FOR (n:Vehicle) ON (n.vin)`,
  `CREATE INDEX vehicle_plate_index IF NOT EXISTS FOR (n:Vehicle) ON (n.licensePlate)`,

  // LicensePlate / VIN
  `CREATE INDEX license_plate_value_index IF NOT EXISTS FOR (n:LicensePlate) ON (n.value)`,
  `CREATE INDEX license_plate_normalized_value_index IF NOT EXISTS FOR (n:LicensePlate) ON (n.normalizedValue)`,
  `CREATE INDEX vin_value_index IF NOT EXISTS FOR (n:VIN) ON (n.value)`,
  `CREATE INDEX vin_normalized_value_index IF NOT EXISTS FOR (n:VIN) ON (n.normalizedValue)`,

  // CourtCase
  `CREATE INDEX court_case_number_index IF NOT EXISTS FOR (n:CourtCase) ON (n.caseNumber)`,
  `CREATE INDEX court_case_court_index IF NOT EXISTS FOR (n:CourtCase) ON (n.court)`,
  `CREATE INDEX court_case_status_index IF NOT EXISTS FOR (n:CourtCase) ON (n.status)`,

  // Source / Evidence
  `CREATE INDEX source_name_index IF NOT EXISTS FOR (n:Source) ON (n.name)`,
  `CREATE INDEX source_type_index IF NOT EXISTS FOR (n:Source) ON (n.sourceType)`,
  `CREATE INDEX source_url_index IF NOT EXISTS FOR (n:Source) ON (n.url)`,
  `CREATE INDEX evidence_source_id_index IF NOT EXISTS FOR (n:Evidence) ON (n.sourceId)`,
  `CREATE INDEX evidence_hash_index IF NOT EXISTS FOR (n:Evidence) ON (n.hashSha256)`,
  `CREATE INDEX evidence_captured_at_index IF NOT EXISTS FOR (n:Evidence) ON (n.capturedAt)`,

  // Finding
  `CREATE INDEX finding_severity_index IF NOT EXISTS FOR (n:Finding) ON (n.severity)`,
  `CREATE INDEX finding_confidence_index IF NOT EXISTS FOR (n:Finding) ON (n.confidence)`,
  `CREATE INDEX finding_risk_score_index IF NOT EXISTS FOR (n:Finding) ON (n.riskScore)`,
  `CREATE INDEX finding_status_index IF NOT EXISTS FOR (n:Finding) ON (n.status)`,

  // Case / Investigation
  `CREATE INDEX case_name_index IF NOT EXISTS FOR (n:Case) ON (n.name)`,
  `CREATE INDEX case_status_index IF NOT EXISTS FOR (n:Case) ON (n.status)`,
  `CREATE INDEX case_priority_index IF NOT EXISTS FOR (n:Case) ON (n.priority)`,
  `CREATE INDEX investigation_name_index IF NOT EXISTS FOR (n:Investigation) ON (n.name)`,
  `CREATE INDEX investigation_status_index IF NOT EXISTS FOR (n:Investigation) ON (n.status)`,
  `CREATE INDEX investigation_case_id_index IF NOT EXISTS FOR (n:Investigation) ON (n.caseId)`,

  // Tag
  `CREATE INDEX tag_value_index IF NOT EXISTS FOR (n:Tag) ON (n.value)`,
  `CREATE INDEX tag_normalized_value_index IF NOT EXISTS FOR (n:Tag) ON (n.normalizedValue)`,

  // AI
  `CREATE INDEX ai_insight_confidence_index IF NOT EXISTS FOR (n:AIInsight) ON (n.confidence)`,
  `CREATE INDEX ai_insight_risk_score_index IF NOT EXISTS FOR (n:AIInsight) ON (n.riskScore)`,
  `CREATE INDEX ai_insight_model_index IF NOT EXISTS FOR (n:AIInsight) ON (n.model)`,
  `CREATE INDEX risk_signal_severity_index IF NOT EXISTS FOR (n:RiskSignal) ON (n.severity)`,
  `CREATE INDEX risk_signal_confidence_index IF NOT EXISTS FOR (n:RiskSignal) ON (n.confidence)`,
  `CREATE INDEX risk_signal_risk_score_index IF NOT EXISTS FOR (n:RiskSignal) ON (n.riskScore)`,
];

export const NEO4J_FULLTEXT_INDEXES: string[] = [
  `CREATE FULLTEXT INDEX entity_fulltext_index IF NOT EXISTS
   FOR (n:Entity) ON EACH [n.name, n.value, n.normalizedValue, n.description]`,

  `CREATE FULLTEXT INDEX person_fulltext_index IF NOT EXISTS
   FOR (n:Person) ON EACH [n.name, n.fullName, n.displayName, n.notes]`,

  `CREATE FULLTEXT INDEX company_fulltext_index IF NOT EXISTS
   FOR (n:Company) ON EACH [n.name, n.legalName, n.commercialName]`,

  `CREATE FULLTEXT INDEX document_fulltext_index IF NOT EXISTS
   FOR (n:Document) ON EACH [n.title, n.filename, n.extractedText]`,

  `CREATE FULLTEXT INDEX post_fulltext_index IF NOT EXISTS
   FOR (n:Post) ON EACH [n.text, n.authorUsername]`,

  `CREATE FULLTEXT INDEX finding_fulltext_index IF NOT EXISTS
   FOR (n:Finding) ON EACH [n.title, n.description]`,
];
