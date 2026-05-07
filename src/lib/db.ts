import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function checkDbConnection() {
  const client = await pool.connect();
  try {
    await client.query('select 1');
  } finally {
    client.release();
  }
}
