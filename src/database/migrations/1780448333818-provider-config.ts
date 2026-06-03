import { MigrationInterface, QueryRunner } from "typeorm";

export class ProviderConfig1780448333818 implements MigrationInterface {
    name = 'ProviderConfig1780448333818'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "provider_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "providerSource" character varying(100) NOT NULL, "key" character varying(100) NOT NULL, "label" character varying(200) NOT NULL, "encryptedValue" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_31f2884572a5fef8e25a08b5a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4cd1103b5a1c837086f3f54191" ON "provider_credentials"  ("providerSource", "key") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_4cd1103b5a1c837086f3f54191"`);
        await queryRunner.query(`DROP TABLE "provider_credentials"`);
    }

}
