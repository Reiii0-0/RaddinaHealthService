import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

export const DRIZZLE_DB = 'DRIZZLE_DB';
export type DrizzleDB = NodePgDatabase<typeof schema>;

export const pgPool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://raddina:raddina_secret_password@localhost:5432/raddina_health_db',
  max: 20,
});

export const db: DrizzleDB = drizzle(pgPool, { schema });

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useValue: db,
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
