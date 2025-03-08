import dotenv from "dotenv";
import { SimpleWorkflow } from "./workflows/simple.js";
import { ReflectionWorkflow } from "./workflows/simple_reflection.js";

// Load environment variables
dotenv.config();

async function main() {
  // Create a simple workflow instance
  const simpleWorkflow = new SimpleWorkflow();
  console.log(`Running ${simpleWorkflow.name}...`);
  const simpleResult = await simpleWorkflow.run();
  console.log(`Simple workflow result:`, simpleResult);

  // Create a reflection workflow instance
  const reflectionWorkflow = new ReflectionWorkflow();
  console.log(`Running ${reflectionWorkflow.name}...`);
  const reflectionResult = await reflectionWorkflow.run();
  console.log(`Reflection workflow result:`, reflectionResult);
}

main().catch(console.error);
