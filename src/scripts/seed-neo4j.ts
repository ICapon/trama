import 'dotenv/config';
import neo4j from 'neo4j-driver';
import { NEO4J_CONSTRAINTS } from '../apps/modules/graph/seeds/neo4j.constraints';
import { NEO4J_FULLTEXT_INDEXES, NEO4J_INDEXES } from '../apps/modules/graph/seeds/neo4j.indexes';
import {
  getNodeCategorySeedQueries,
  getRelationshipTypeSeedQueries,
} from '../apps/modules/graph/seeds/neo4j.seed';

async function runQueries(
  session: ReturnType<ReturnType<typeof neo4j.driver>['session']>,
  label: string,
  queries: string[],
  { ignoreErrors = false } = {},
): Promise<void> {
  console.log(`  Running ${queries.length} ${label}...`);
  let ok = 0;
  for (const query of queries) {
    try {
      await session.run(query);
      ok++;
    } catch (err: unknown) {
      if (ignoreErrors) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ⚠  ${msg}`);
      } else {
        throw err;
      }
    }
  }
  console.log(`  ✓ ${ok}/${queries.length} ${label} applied`);
}

async function runParamQueries(
  session: ReturnType<ReturnType<typeof neo4j.driver>['session']>,
  label: string,
  queries: { query: string; params: Record<string, unknown> }[],
): Promise<void> {
  console.log(`  Running ${queries.length} ${label}...`);
  for (const { query, params } of queries) {
    await session.run(query, params);
  }
  console.log(`  ✓ ${queries.length} ${label} applied`);
}

async function main(): Promise<void> {
  const uri = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
  const username = process.env.NEO4J_USER ?? 'neo4j';
  const password = process.env.NEO4J_PASSWORD ?? '';
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';

  console.log(`\n🌱 Trama Neo4j Seed`);
  console.log(`   URI:      ${uri}`);
  console.log(`   Database: ${database}\n`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  const session = driver.session({ database });

  try {
    await driver.verifyConnectivity();
    console.log('✓ Connected\n');

    console.log('[ Constraints ]');
    await runQueries(session, 'constraints', NEO4J_CONSTRAINTS);

    console.log('\n[ Indexes ]');
    await runQueries(session, 'indexes', NEO4J_INDEXES);

    console.log('\n[ Fulltext indexes ]');
    // IF NOT EXISTS for fulltext may not be supported on older Neo4j 5.x patches.
    await runQueries(session, 'fulltext indexes', NEO4J_FULLTEXT_INDEXES, {
      ignoreErrors: true,
    });

    console.log('\n[ Node type catalog ]');
    await runParamQueries(session, 'node types', getNodeCategorySeedQueries());

    console.log('\n[ Relationship type catalog ]');
    await runParamQueries(
      session,
      'relationship types',
      getRelationshipTypeSeedQueries(),
    );

    console.log('\n🎉 Seed complete!\n');
  } catch (err: unknown) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
