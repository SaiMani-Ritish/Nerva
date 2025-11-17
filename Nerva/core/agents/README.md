# Agents

Specialized agents for complex task handling in Nerva.

## Available Agents

- `planner.ts` - Breaks down goals into executable steps
- `executor.ts` - Executes plans with retry logic and progress tracking
- `summarizer.ts` - Compresses conversations and documents

## Agent Interface

All agents use prompt templates defined in `docs/prompts/agent_templates.md`.

## Usage

```typescript
import { PlannerAgent } from "./planner";

const planner = new PlannerAgent(modelAdapter);
const plan = await planner.createPlan(intent, context);
```

