# AI Agent Runner

## Overview

- Command-line tool for running AI agents
- Ability to run one or more agents
- Configurable execution mode (parallel, async promises, or series)
- Customizable console logging levels
- Performance tracking and reporting

## Core Components

### Agent Abstract Class

- Abstract class that all agents must extend
- Properties:
  - `name` (abstract, to be implemented by subclasses)
  - `score` (public, initialized to 0)
  - `moves` (public, initialized to 0)
- Methods:
  - `run()` (abstract, to be implemented by subclasses)

### Main Index File

- Entry point for the command-line tool
- Responsibilities:
  - Parse command-line arguments
  - Import and instantiate selected agents
  - Execute agents according to specified mode
  - Measure execution time for each agent
  - Generate and display summary report

## Command-Line Options

- Agent selection:
  - Run specific agents by name
  - Run all available agents
- Execution mode:
  - Parallel execution
  - Async promises
  - Series execution
- Logging:
  - Set console log level (info, debug, etc.)
  - Control verbosity of output

## Execution Flow

1. Parse command-line arguments
2. Identify and instantiate selected agents
3. Execute agents according to specified mode
4. Track execution time, score, and moves for each agent
5. Generate summary report after all agents complete

## Summary Report

- For each agent:
  - Agent name
  - Execution time
  - Final score
  - Number of moves
- Overall statistics:
  - Total execution time
  - Average score
  - Average number of moves
