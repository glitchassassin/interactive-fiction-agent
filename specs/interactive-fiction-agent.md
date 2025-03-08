# Interactive Fiction Agent Specification

## Overview

This specification outlines the development of an interactive fiction agent using the Vercel AI SDK. The agent will facilitate interactive storytelling experiences by maintaining context, generating responses, and providing a persistent memory system.

## Components

### 1. Persistence Layer

We will use Turso's LibSQL to implement a local SQLite database for storing conversation history and agent memory.

#### Database Schema

**Messages Table**

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata TEXT,  -- JSON string for additional data
  embedding BLOB  -- Vector embedding for semantic search
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

**Memory Table**

```sql
CREATE TABLE memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  importance REAL DEFAULT 1.0,  -- For prioritizing memories
  embedding BLOB,  -- Vector embedding for semantic search
  metadata TEXT  -- JSON string for additional data
);

CREATE INDEX idx_memory_agent_id ON memory(agent_id);
CREATE INDEX idx_memory_importance ON memory(importance);
```

#### Persistence Service

The persistence service will provide the following functionality:

1. **Message Operations**

   - Store new messages in a thread
   - Retrieve messages by thread ID
   - Retrieve recent messages (e.g., last 40)
   - Search messages by semantic similarity

2. **Memory Operations**
   - Store new memories for an agent
   - Update existing memories
   - Retrieve memories by recency
   - Retrieve memories by semantic similarity
   - Consolidate and summarize memories

### 2. Agent System

Agents will be defined as a combination of a system prompt and a model configuration.

#### Agent Definition

```typescript
class Agent {
  constructor(
    public systemPrompt: string,
    public model: LanguageModel;
  ) {}

  generate(prompt: string, messages?: Array<CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage> | Array<UIMessage>)
}
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. Set up project structure
2. Implement database schema using Turso's LibSQL
3. Create basic persistence service for messages and memory
4. Implement agent definition and basic generation

### Phase 2: Enhanced Features

1. Add semantic search capabilities
2. Implement memory consolidation and summarization
3. Add support for multiple model providers
4. Create a simple CLI interface for testing

### Phase 3: Advanced Features

1. Implement working memory management
2. Add support for tools and function calling
3. Create a web interface
4. Implement multi-agent conversations

## Technical Requirements

- Node.js environment
- TypeScript for type safety
- Vercel AI SDK for model integration
- Turso's LibSQL for local database
- Vector embeddings for semantic search

## API Design

### Persistence API

```typescript
interface PersistenceService {
  // Message operations
  addMessage(
    threadId: string,
    role: string,
    content: string,
    metadata?: any
  ): Promise<string>;
  getMessagesByThread(threadId: string, limit?: number): Promise<Message[]>;
  searchMessagesBySimilarity(
    threadId: string,
    query: string,
    limit?: number
  ): Promise<Message[]>;

  // Memory operations
  addMemory(
    agentId: string,
    content: string,
    importance?: number,
    metadata?: any
  ): Promise<string>;
  updateMemory(memoryId: string, updates: Partial<Memory>): Promise<void>;
  getMemoriesByAgent(agentId: string, limit?: number): Promise<Memory[]>;
  searchMemoriesBySimilarity(
    agentId: string,
    query: string,
    limit?: number
  ): Promise<Memory[]>;
  consolidateMemories(agentId: string): Promise<void>;
}
```
