/**
 * Database schema for the interactive fiction agent
 */

export const SCHEMA = {
  MESSAGES_TABLE: `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      metadata TEXT,
      embedding BLOB
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `,
  
  MEMORY_TABLE: `
    CREATE TABLE IF NOT EXISTS memory (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      importance REAL DEFAULT 1.0,
      embedding BLOB,
      metadata TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_memory_agent_id ON memory(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory(importance);
  `
}; 