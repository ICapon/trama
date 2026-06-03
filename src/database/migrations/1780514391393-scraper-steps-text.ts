import { MigrationInterface, QueryRunner } from "typeorm";

export class ScraperStepsText1780514391393 implements MigrationInterface {
    name = 'ScraperStepsText1780514391393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scrape_step_logs" DROP COLUMN "url"`);
        await queryRunner.query(`ALTER TABLE "scrape_step_logs" ADD "url" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scrape_step_logs" DROP COLUMN "url"`);
        await queryRunner.query(`ALTER TABLE "scrape_step_logs" ADD "url" character varying(500)`);
    }

}
