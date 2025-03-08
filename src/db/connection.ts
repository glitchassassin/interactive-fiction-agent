import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { SCHEMA } from './schema.js';

// Load environment variables
dotenv.config();

// Database URL and auth token from environment variables
const dbUrl = process.env.DATABASE_URL || 'file:./data.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Create database client
export const db = createClient({
  url: dbUrl,
  authToken: authToken
});

/**
 * Initialize the database by creating the required tables
 */
export async function initializeDatabase() {
  try {
    // Create messages table
    await db.execute(SCHEMA.MESSAGES_TABLE);
    
    // Create memory table
    await db.execute(SCHEMA.MEMORY_TABLE);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
} 