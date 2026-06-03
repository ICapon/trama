import { MigrationInterface, QueryRunner } from "typeorm";

export class GraphConfig1780277772415 implements MigrationInterface {
    name = 'GraphConfig1780277772415'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "graph_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "investigationId" uuid NOT NULL, "name" character varying(80) NOT NULL, "description" text, "filters" jsonb NOT NULL, "layout" character varying(20) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_49c67dd62ddb2ec1894b3a14ee2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "graph_configs" ADD CONSTRAINT "FK_270e4ac4ddd40e9d7ef473ccd4c" FOREIGN KEY ("investigationId") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "graph_configs" DROP CONSTRAINT "FK_270e4ac4ddd40e9d7ef473ccd4c"`);
        await queryRunner.query(`DROP TABLE "graph_configs"`);
    }

}
