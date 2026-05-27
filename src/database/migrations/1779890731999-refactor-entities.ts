import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorEntities1779890731999 implements MigrationInterface {
    name = 'RefactorEntities1779890731999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."scrape_results_status_enum" AS ENUM('success', 'partial', 'no_data', 'error')`);
        await queryRunner.query(`CREATE TABLE "scrape_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scrapeJobId" uuid NOT NULL, "investigationId" uuid NOT NULL, "entityId" character varying NOT NULL, "source" character varying NOT NULL, "sourceUrl" character varying, "status" "public"."scrape_results_status_enum" NOT NULL, "confidence" double precision, "rawData" jsonb, "summary" jsonb, "nodesCreated" integer NOT NULL DEFAULT '0', "relationshipsCreated" integer NOT NULL DEFAULT '0', "neo4jNodeIds" text array NOT NULL DEFAULT '{}', "neo4jScrapeResultId" character varying, "executedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "durationMs" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3c8ec1d8289b3876d1aaa44a982" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "personId"`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "rawResult"`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "createdNodeIds"`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "neo4jScrapeResultId"`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "entityId" character varying`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "investigationId" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "investigationId"`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "entityId"`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "neo4jScrapeResultId" character varying`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "createdNodeIds" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "rawResult" jsonb`);
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "personId" uuid NOT NULL`);
        await queryRunner.query(`DROP TABLE "scrape_results"`);
        await queryRunner.query(`DROP TYPE "public"."scrape_results_status_enum"`);
    }

}
