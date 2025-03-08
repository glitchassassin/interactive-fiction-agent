# Interactive Fiction Agent

A TypeScript application for creating interactive fiction experiences with AI-powered storytelling. This project uses Turso's LibSQL for persistence and the Vercel AI SDK for language model integration.

## Features

- Persistent storage of conversation history and agent memory
- Integration with OpenAI language models
- Semantic search capabilities (placeholder implementation)
- Memory consolidation (placeholder implementation)

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd interactive-fiction-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:
   ```
   # Database Configuration
   DATABASE_URL="file:./data.db"
   DATABASE_AUTH_TOKEN=""

   # AI Model Configuration
   AI_MODEL="openai"
   OPENAI_API_KEY="your-openai-api-key"
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run the built project:
   ```bash
   npm start
   ```

## Project Structure

- `src/db/`: Database schema and connection
- `src/models/`: Type definitions and agent implementation
- `src/services/`: Persistence service implementation
- `src/index.ts`: Main entry point

## Database Schema

### Messages Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata TEXT,
  embedding BLOB
);
```

### Memory Table
```sql
CREATE TABLE memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  importance REAL DEFAULT 1.0,
  embedding BLOB,
  metadata TEXT
);
```

## License

ISC 