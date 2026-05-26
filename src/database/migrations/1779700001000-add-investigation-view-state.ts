import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvestigationViewState1779700001000 implements MigrationInterface {
  name = 'AddInvestigationViewState1779700001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "investigations" ADD COLUMN "viewState" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "investigations" DROP COLUMN "viewState"`,
    );
  }
}
