import { pgPool } from '../../src/db/index';
import { seedDatabase } from '../../src/db/seed';

export async function resetAndSeedDatabase(): Promise<void> {
  await seedDatabase();
}

export async function closeDatabasePool(): Promise<void> {
  await pgPool.end();
}
