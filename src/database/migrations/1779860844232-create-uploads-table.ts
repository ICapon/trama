import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUploadsTable1779860844232 implements MigrationInterface {
    name = 'CreateUploadsTable1779860844232'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "uploads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "originalName" character varying NOT NULL, "filename" character varying NOT NULL, "mimeType" character varying NOT NULL, "size" integer NOT NULL, "path" character varying NOT NULL, "url" character varying NOT NULL, "uploadedBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d1781d1eedd7459314f60f39bd3" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "uploads"`);
    }

}
