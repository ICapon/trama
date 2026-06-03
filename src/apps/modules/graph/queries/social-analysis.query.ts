// Post-level metrics: counts, engagement, breakdown by type
export const POST_METRICS_QUERY = `
  MATCH (p:Entity { id: $id })
  OPTIONAL MATCH (p)-[:POSTED]->(post:Entity { type: 'Post' })
  RETURN
    count(post)                                                                AS totalPosts,
    avg(coalesce(toFloat(post.likesCount),    0))                             AS avgLikes,
    avg(coalesce(toFloat(post.retweetsCount), 0))                             AS avgRetweets,
    avg(coalesce(toFloat(post.repliesCount),  0))                             AS avgReplies,
    avg(coalesce(toFloat(post.quotesCount),   0))                             AS avgQuotes,
    count(CASE WHEN post.postType = 'original'   THEN 1 END)                 AS originalCount,
    count(CASE WHEN post.postType = 'retweeted'  THEN 1 END)                 AS retweetedCount,
    count(CASE WHEN post.postType = 'quoted'     THEN 1 END)                 AS quotedCount,
    count(CASE WHEN post.postType = 'replied_to' THEN 1 END)                 AS repliedCount
`;

// Top hashtags by frequency across all posts
export const TOP_HASHTAGS_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(:Entity { type: 'Post' })-[:HAS_HASHTAG]->(ht:Entity { type: 'Hashtag' })
  RETURN ht.normalizedValue AS tag, count(*) AS freq
  ORDER BY freq DESC
  LIMIT 15
`;

// Co-occurring hashtag pairs (narrative detection)
export const HASHTAG_COOCCURRENCE_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(post:Entity { type: 'Post' })
  MATCH (post)-[:HAS_HASHTAG]->(ht1:Entity { type: 'Hashtag' })
  MATCH (post)-[:HAS_HASHTAG]->(ht2:Entity { type: 'Hashtag' })
  WHERE ht1.normalizedValue < ht2.normalizedValue
  RETURN ht1.normalizedValue AS tagA, ht2.normalizedValue AS tagB, count(*) AS coFreq
  ORDER BY coFreq DESC
  LIMIT 10
`;

// Top domains shared in posts
export const TOP_DOMAINS_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(:Entity { type: 'Post' })-[:CONTAINS_LINK]->(dom:Entity { type: 'Domain' })
  RETURN dom.value AS domain, count(*) AS freq
  ORDER BY freq DESC
  LIMIT 10
`;

// Top mentioned accounts with mention count
export const TOP_MENTIONS_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(:Entity { type: 'Post' })-[:MENTIONS]->(m:Entity { type: 'SocialProfile' })
  RETURN m.normalizedValue AS handle, count(*) AS freq
  ORDER BY freq DESC
  LIMIT 10
`;

// Most replied-to accounts
export const TOP_REPLIES_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(:Entity { type: 'Post' })-[:REPLIED_TO]->(m:Entity { type: 'SocialProfile' })
  RETURN m.normalizedValue AS handle, count(*) AS freq
  ORDER BY freq DESC
  LIMIT 10
`;

// Most retweeted accounts
export const TOP_RETWEETS_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(:Entity { type: 'Post' })-[:RETWEETED]->(m:Entity { type: 'SocialProfile' })
  RETURN m.normalizedValue AS handle, count(*) AS freq
  ORDER BY freq DESC
  LIMIT 10
`;

// Network: followers and following captured in graph
export const NETWORK_STATS_QUERY = `
  MATCH (p:Entity { id: $id })
  OPTIONAL MATCH (follower:Entity { type: 'SocialProfile' })-[:FOLLOWS]->(p)
  WITH p, count(DISTINCT follower) AS followersInGraph
  OPTIONAL MATCH (p)-[:FOLLOWS]->(following:Entity { type: 'SocialProfile' })
  RETURN followersInGraph, count(DISTINCT following) AS followingInGraph
`;

// Reciprocal mentions: accounts this profile mentions that also mention it back
export const RECIPROCAL_MENTIONS_QUERY = `
  MATCH (p:Entity { id: $id })-[:POSTED]->(:Entity { type: 'Post' })-[:MENTIONS]->(other:Entity { type: 'SocialProfile' })
  MATCH (other)-[:POSTED|MENTIONS*1..2]-(p)
  RETURN count(DISTINCT other) AS reciprocalCount
`;
