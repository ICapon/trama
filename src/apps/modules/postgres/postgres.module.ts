import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: Number(process.env.POSTGRES_PORT ?? 5432),
        username: process.env.POSTGRES_USER ?? 'postgres',
        password: process.env.POSTGRES_PASSWORD ?? '',
        database: process.env.POSTGRES_DB ?? 'trama',
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../../../database/migrations/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
  ],
})
export class PostgresModule {}
