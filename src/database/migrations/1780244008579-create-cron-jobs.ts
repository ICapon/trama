import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCronJobs1780244008579 implements MigrationInterface {
    name = 'CreateCronJobs1780244008579'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."cron_jobs_status_enum" AS ENUM('active', 'paused')`);
        await queryRunner.query(`CREATE TABLE "cron_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "description" text, "cronExpression" character varying NOT NULL, "source" character varying NOT NULL, "entityId" character varying NOT NULL, "investigationId" uuid NOT NULL, "seed" jsonb, "config" jsonb, "status" "public"."cron_jobs_status_enum" NOT NULL DEFAULT 'active', "schedulerKey" character varying, "lastRunAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_189a8029b8fff4f0e2040f652ee" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "cron_jobs"`);
        await queryRunner.query(`DROP TYPE "public"."cron_jobs_status_enum"`);
    }

}
