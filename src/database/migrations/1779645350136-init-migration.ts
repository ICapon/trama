import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1779645350136 implements MigrationInterface {
    name = 'InitMigration1779645350136'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."investigations_status_enum" AS ENUM('open', 'in_progress', 'closed')`);
        await queryRunner.query(`CREATE TYPE "public"."investigations_priority_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TABLE "investigations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "status" "public"."investigations_status_enum" NOT NULL DEFAULT 'open', "priority" "public"."investigations_priority_enum" NOT NULL DEFAULT 'medium', "targetNodeIds" text array NOT NULL DEFAULT '{}', "targetNodeLabels" text array NOT NULL DEFAULT '{}', "targetNodeTypes" text array NOT NULL DEFAULT '{}', "hypothesis" text, "tags" text array NOT NULL DEFAULT '{}', "ownerId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2fffe8ebb1cf4b2fc03a26ac8d9" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "investigations"`);
        await queryRunner.query(`DROP TYPE "public"."investigations_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."investigations_status_enum"`);
    }

}
