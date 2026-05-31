import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConfig1780176198284 implements MigrationInterface {
    name = 'AddConfig1780176198284'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scrape_jobs" ADD "config" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scrape_jobs" DROP COLUMN "config"`);
    }

}
