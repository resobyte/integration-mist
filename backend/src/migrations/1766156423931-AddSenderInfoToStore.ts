import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSenderInfoToStore1766156423931 implements MigrationInterface {
    name = 'AddSenderInfoToStore1766156423931'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`stores\` ADD \`senderName\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`stores\` ADD \`senderAddress\` varchar(500) NULL`);
        await queryRunner.query(`ALTER TABLE \`stores\` ADD \`senderCity\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`stores\` ADD \`senderDistrict\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`stores\` ADD \`senderPhone\` varchar(20) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`stores\` DROP COLUMN \`senderPhone\``);
        await queryRunner.query(`ALTER TABLE \`stores\` DROP COLUMN \`senderDistrict\``);
        await queryRunner.query(`ALTER TABLE \`stores\` DROP COLUMN \`senderCity\``);
        await queryRunner.query(`ALTER TABLE \`stores\` DROP COLUMN \`senderAddress\``);
        await queryRunner.query(`ALTER TABLE \`stores\` DROP COLUMN \`senderName\``);
    }

}
