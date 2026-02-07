import { CommandParser } from './command-parser'
import { Plan, Task } from './task-queue'

interface LLMPlanResponse {
  inventory_analysis?: string
  failure_analysis?: string
  goal: string
  reasoning: string
  plan: string[]
}

export class PlanParser {
  private commandParser: CommandParser

  constructor() {
    this.commandParser = new CommandParser()
  }

  /**
   * Parse LLM response into a Plan
   * Handles both JSON format and fallback to single command
   */
  public parsePlan(response: string): Plan | null {
    console.log('[PlanParser] Parsing LLM response...')

    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as LLMPlanResponse

        // Validate required fields
        if (!parsed.goal || !parsed.plan || !Array.isArray(parsed.plan)) {
          console.log('[PlanParser] ⚠️  Invalid plan format, missing required fields')
          return this.fallbackToSingleCommand(response)
        }

        // Parse each command in the plan
        const tasks: Task[] = []
        for (const commandStr of parsed.plan) {
          const command = this.commandParser.parse(commandStr)

          if (command) {
            tasks.push({
              command,
              description: commandStr,
              retryCount: 0,
              maxRetries: 2
            })
          } else {
            console.log(`[PlanParser] ⚠️  Failed to parse command: ${commandStr}`)
          }
        }

        if (tasks.length === 0) {
          console.log('[PlanParser] ⚠️  No valid tasks in plan')
          return null
        }

        const plan: Plan = {
          tasks,
          goal: parsed.goal,
          reasoning: parsed.reasoning || 'No reasoning provided'
        }

        // Log inventory analysis if provided
        if (parsed.inventory_analysis) {
          console.log(`[PlanParser] 📦 Inventory Analysis: ${parsed.inventory_analysis}`)
        } else {
          console.log(`[PlanParser] ⚠️  WARNING: No inventory_analysis provided!`)
        }

        // Log failure analysis if provided
        if (parsed.failure_analysis) {
          console.log(`[PlanParser] 🔍 Failure Analysis: ${parsed.failure_analysis}`)
        }

        console.log(`[PlanParser] ✅ Parsed plan with ${tasks.length} tasks`)
        return plan

      } catch (err) {
        console.log('[PlanParser] ⚠️  JSON parse error:', err instanceof Error ? err.message : err)
        return this.fallbackToSingleCommand(response)
      }
    } else {
      // No JSON found - treat as single command
      console.log('[PlanParser] No JSON found, treating as single command')
      return this.fallbackToSingleCommand(response)
    }
  }

  /**
   * Fallback: treat response as a single command
   */
  private fallbackToSingleCommand(response: string): Plan | null {
    // Extract first line as command
    const line = response.trim().split('\n')[0].trim()
    const command = this.commandParser.parse(line)

    if (!command) {
      console.log('[PlanParser] ⚠️  Failed to parse as command:', line)
      return null
    }

    return {
      tasks: [{
        command,
        description: line,
        retryCount: 0,
        maxRetries: 2
      }],
      goal: 'Single action',
      reasoning: 'Fallback to single command'
    }
  }

  /**
   * Create a simple plan from a single command string
   */
  public createSingleCommandPlan(commandStr: string, goal: string = 'Single task'): Plan | null {
    const command = this.commandParser.parse(commandStr)

    if (!command) {
      return null
    }

    return {
      tasks: [{
        command,
        description: commandStr,
        retryCount: 0,
        maxRetries: 2
      }],
      goal,
      reasoning: 'User-requested task'
    }
  }
}
