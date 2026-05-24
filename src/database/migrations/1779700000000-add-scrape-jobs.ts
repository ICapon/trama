import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScrapeJobs1779700000000 implements MigrationInterface {
  name = 'AddScrapeJobs1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."scrape_jobs_status_enum" AS ENUM('pending', 'running', 'completed', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "scrape_jobs" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "personId"            uuid NOT NULL,
        "source"              character varying NOT NULL,
        "status"              "public"."scrape_jobs_status_enum" NOT NULL DEFAULT 'pending',
        "seed"                jsonb NOT NULL,
        "rawResult"           jsonb,
        "createdNodeIds"      text array NOT NULL DEFAULT '{}',
        "errorMessage"        text,
        "bullJobId"           character varying,
        "neo4jScrapeResultId" character varying,
        "startedAt"           TIMESTAMP WITH TIME ZONE,
        "finishedAt"          TIMESTAMP WITH TIME ZONE,
        "createdAt"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scrape_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_scrape_jobs_personId" ON "scrape_jobs" ("personId")`);
    await queryRunner.query(`CREATE INDEX "IDX_scrape_jobs_status" ON "scrape_jobs" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_scrape_jobs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_scrape_jobs_personId"`);
    await queryRunner.query(`DROP TABLE "scrape_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."scrape_jobs_status_enum"`);
  }
}
