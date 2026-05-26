import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProviderTable1779756478695 implements MigrationInterface {
    name = 'CreateProviderTable1779756478695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."providers_category_enum" AS ENUM('identity', 'social', 'financial', 'legal', 'location', 'communications')`);
        await queryRunner.query(`CREATE TABLE "providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source" character varying NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, "version" character varying NOT NULL DEFAULT '1.0.0', "category" "public"."providers_category_enum" NOT NULL, "countries" text array NOT NULL DEFAULT '{}', "supportedInputs" text array NOT NULL DEFAULT '{}', "outputNodeTypes" text array NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "totalRuns" integer NOT NULL DEFAULT '0', "successCount" integer NOT NULL DEFAULT '0', "failCount" integer NOT NULL DEFAULT '0', "avgDurationMs" integer, "lastRunAt" TIMESTAMP WITH TIME ZONE, "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_71b6bbb249efc9cf2809a132a45" UNIQUE ("source"), CONSTRAINT "PK_af13fc2ebf382fe0dad2e4793aa" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "providers"`);
        await queryRunner.query(`DROP TYPE "public"."providers_category_enum"`);
    }

}
