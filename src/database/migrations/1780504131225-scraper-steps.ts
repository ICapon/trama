import { MigrationInterface, QueryRunner } from "typeorm";

export class ScraperSteps1780504131225 implements MigrationInterface {
    name = 'ScraperSteps1780504131225'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "scrape_step_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "providerSource" character varying(100) NOT NULL, "entityId" uuid, "stepType" character varying(50) NOT NULL, "url" character varying(500), "httpStatus" integer, "durationMs" integer, "success" boolean NOT NULL DEFAULT true, "extractedData" jsonb, "nodesCreated" integer NOT NULL DEFAULT '0', "relationshipsCreated" integer NOT NULL DEFAULT '0', "nodeTypes" text, "errorMessage" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3aa9c89c9d6a9dd55f69f1e7a8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8be3e3039eedaf7185ab53846e" ON "scrape_step_logs"  ("providerSource", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_9cb024a253aa8b1d4b71602a27" ON "scrape_step_logs"  ("providerSource", "entityId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9cb024a253aa8b1d4b71602a27"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8be3e3039eedaf7185ab53846e"`);
        await queryRunner.query(`DROP TABLE "scrape_step_logs"`);
    }

}
