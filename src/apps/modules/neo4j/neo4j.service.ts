import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import neo4j, { Driver, QueryResult } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver!: Driver;
  private database!: string;

  onModuleInit(): void {
    const uri = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
    const username = process.env.NEO4J_USER ?? 'neo4j';
    const password = process.env.NEO4J_PASSWORD ?? '';
    this.database = process.env.NEO4J_DATABASE ?? 'neo4j';

    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    this.logger.log(`Neo4j driver initialized → ${uri} (db: ${this.database})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver?.close();
  }

  async read(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.executeRead((tx) => tx.run(query, params));
    } finally {
      await session.close();
    }
  }

  async write(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.executeWrite((tx) => tx.run(query, params));
    } finally {
      await session.close();
    }
  }

  // Direct session for scripts that manage their own transactions.
  getSession() {
    return this.driver.session({ database: this.database });
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
