import { execSync } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';

export default async function globalSetup() {
  config({ path: path.resolve(__dirname, '../../../.env.test'), override: true });

  // Create questlog_test database if it doesn't exist
  const adminClient = new Client({
    connectionString: 'postgresql://questlog:questlog@localhost:5432/postgres',
  });
  await adminClient.connect();
  const { rows } = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = 'questlog_test'",
  );
  if (rows.length === 0) {
    await adminClient.query('CREATE DATABASE questlog_test');
  }
  await adminClient.end();

  // Run migrations against the test database
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../../..'),
    env: { ...process.env },
    stdio: 'inherit',
  });
}
