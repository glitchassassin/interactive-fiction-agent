# Interactive Fiction Agent

This project implements an agent system for playing interactive fiction games (text adventures) using different AI-powered workflows.

## Features

- Abstract workflow system for implementing different agent strategies
- Parallel execution of multiple workflows for efficient comparison
- Comprehensive logging and reporting
- Performance metrics and comparison tools

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## Usage

Run the application with:

```bash
npm start
```

### Command Line Options

- `--parallel`: Run workflows in parallel instead of sequentially
- `--max-concurrent <number>`: Maximum number of workflows to run in parallel (default: unlimited)

Example:

```bash
# Run all workflows in parallel
npm start -- --parallel

# Run up to 2 workflows in parallel
npm start -- --parallel --max-concurrent 2
```

## Creating Custom Workflows

To create a custom workflow, extend the `BaseWorkflow` abstract class:

```typescript
import { BaseWorkflow } from "./workflows/base.js";
import { Dialogue } from "./models/dialogue.js";

export class MyCustomWorkflow extends BaseWorkflow {
  readonly name = "My Custom Workflow";

  protected async gameLoop(dialogue: Dialogue): Promise<string> {
    // Implement your game logic here
    return "some command";
  }
}
```

Then add your workflow to the list in `index.ts`:

```typescript
const workflows = [
  // Existing workflows
  new SimpleWorkflow(),
  new ReflectionWorkflow(),

  // Your custom workflow
  new MyCustomWorkflow(),
];
```

## Configuration Options

Workflows can be configured with various options:

```typescript
new MyCustomWorkflow({
  maxIterations: 150, // Maximum number of game turns
  gamePath: "adventure.z5", // Path to the game file
  dialogueLimit: 100, // Maximum dialogue history size
  displayName: "Custom Name", // Custom display name
});
```

## Results and Logs

After running the workflows, the application will:

1. Display a comparison table of all workflow results
2. Identify the best-performing workflows by different metrics
3. Save detailed logs for each workflow run

Logs are saved to the `./logs` directory by default.

## License

MIT
