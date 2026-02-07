import mineflayer, { Bot } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder'
import { mineflayer as mineflayerViewer } from 'prismarine-viewer'
import { PerceptionSystem } from './perception'
import { LLMAgent } from './llm-agent'
import { PlanParser } from './plan-parser'
import { ActionExecutor } from './action-executor'
import { TaskQueue, Task } from './task-queue'
import { ContextBuilder } from './context-builder'
import { BotConfig, LLMConfig } from './types'

export class AIBot {
  private bot: Bot
  private perception: PerceptionSystem
  private llmAgent: LLMAgent
  private planParser: PlanParser
  private actionExecutor: ActionExecutor
  private taskQueue: TaskQueue
  private contextBuilder: ContextBuilder

  private isExecutingTask = false
  private isRequestingPlan = false
  private isChatting = false
  private executionInterval: NodeJS.Timeout | null = null
  private TASK_EXECUTION_INTERVAL = 1000 // Check for next task every 1 second

  constructor(botConfig: BotConfig, llmConfig: LLMConfig) {
    // Create bot
    this.bot = mineflayer.createBot(botConfig)

    // Load plugins
    this.bot.loadPlugin(pathfinder)

    // Initialize systems
    this.perception = new PerceptionSystem(this.bot)
    this.contextBuilder = new ContextBuilder()
    this.contextBuilder.setRecipeChecker(this.perception.getRecipeChecker())
    this.llmAgent = new LLMAgent(llmConfig, this.contextBuilder)
    this.planParser = new PlanParser()
    this.actionExecutor = new ActionExecutor(this.bot)
    this.taskQueue = new TaskQueue()

    // Setup event handlers
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Bot spawned
    this.bot.once('spawn', () => {
      console.log('[AIBot] 🤖 Bot spawned and ready!')

      // Initialize viewers
      // Note: Viewer version is auto-detected from bot.version
      // If blocks appear incorrect, consider using MINECRAFT_VERSION=1.20.4 in .env for better viewer support
      try {
        mineflayerViewer(this.bot, { port: 3000, firstPerson: false })
        console.log(`[AIBot] 👁️  Viewer (3rd person) started on http://localhost:3000 (bot version: ${this.bot.version})`)
      } catch (err) {
        console.log('[AIBot] Could not start 3rd person viewer:', err)
      }

      try {
        mineflayerViewer(this.bot, { port: 3001, firstPerson: true })
        console.log(`[AIBot] 👁️  Viewer (1st person) started on http://localhost:3001 (bot version: ${this.bot.version})`)
      } catch (err) {
        console.log('[AIBot] Could not start 1st person viewer:', err)
      }

      // Start goal-based task execution
      this.startTaskExecution()

      // Announce presence and request initial plan
      setTimeout(() => {
        this.bot.chat('Hello! I am an AI-powered bot. I\'m here to help and explore!')
        this.requestNewPlan()
      }, 2000)
    })

    // Player chat - interrupt current plan and get new one
    this.bot.on('chat', async (username: string, message: string) => {
      if (username === this.bot.username) return

      console.log(`[AIBot] 💬 Chat from ${username}: ${message}`)

      // Process chat message
      await this.handleChatMessage(username, message)
    })

    // Health monitoring
    this.bot.on('health', () => {
      if (this.bot.health < 5 && this.bot.health > 0) {
        console.warn(`[AIBot] ⚠️  CRITICAL HEALTH: ${this.bot.health}/20`)
      }
    })

    // Error handling
    this.bot.on('error', (err: Error) => {
      console.error('[AIBot] ❌ Bot error:', err.message)
    })

    this.bot.on('kicked', (reason: string) => {
      console.error('[AIBot] ⛔ Bot was kicked:', reason)
      this.stopTaskExecution()
    })

    this.bot.on('end', () => {
      console.log('[AIBot] 👋 Bot disconnected')
      this.stopTaskExecution()
    })
  }

  /**
   * Start task execution loop
   */
  private startTaskExecution(): void {
    console.log('[AIBot] 🔄 Starting goal-based task execution')

    // Execute next task every second
    this.executionInterval = setInterval(() => {
      this.executeNextTask()
    }, this.TASK_EXECUTION_INTERVAL)
  }

  /**
   * Stop task execution loop
   */
  private stopTaskExecution(): void {
    if (this.executionInterval) {
      clearInterval(this.executionInterval)
      this.executionInterval = null
      console.log('[AIBot] ⏸️  Stopped task execution')
    }
  }

  /**
   * Execute next task from queue
   */
  private async executeNextTask(): Promise<void> {
    // Skip if already executing
    if (this.isExecutingTask) {
      return
    }

    // Skip if following someone
    if (this.actionExecutor.isFollowing()) {
      return
    }

    // If queue empty and not requesting, request new plan
    if (this.taskQueue.isEmpty() && !this.isRequestingPlan) {
      console.log('[AIBot] 📭 Queue empty, requesting new plan...')
      await this.requestNewPlan()
      return
    }

    // If queue empty but requesting plan, wait
    if (this.taskQueue.isEmpty() && this.isRequestingPlan) {
      console.log('[AIBot] ⏳ Waiting for LLM response...')
      return
    }

    // Get next task
    const task = this.taskQueue.dequeue()
    if (!task) return

    // Execute task
    this.isExecutingTask = true
    try {
      const success = await this.actionExecutor.execute(task.command)

      if (success) {
        // Task succeeded
        this.taskQueue.markCompleted(task)
      } else {
        // Task failed
        const retryDecision = this.taskQueue.markFailed(task, 'Execution failed')

        // Log failure for LLM to learn
        const actionDesc = this.getActionDescription(task.command)
        const specificError = this.actionExecutor.getLastError()
        this.perception.logFailure(
          task.command.type,
          specificError || `${actionDesc} failed`,
          this.getFailureContext(task.command)
        )

        if (!retryDecision) {
          // Max retries reached, task permanently failed
          console.log('[AIBot] ⚠️  Task failed permanently, continuing with next task')
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[AIBot] ❌ Error executing task:', errorMsg)

      // Mark as failed
      this.taskQueue.markFailed(task, errorMsg)
    } finally {
      this.isExecutingTask = false
    }
  }

  /**
   * Request new plan from LLM
   */
  private async requestNewPlan(playerMessage?: string, username?: string): Promise<void> {
    if (this.isRequestingPlan) {
      console.log('[AIBot] ⏳ Already requesting plan, please wait...')
      return
    }

    this.isRequestingPlan = true

    try {
      console.log('[AIBot] 🧠 Requesting new plan from LLM...')

      // Gather perception
      const perception = this.perception.gatherPerceptionData(this.taskQueue.getCurrentGoal() || undefined)

      // Build user message
      let userMessage = playerMessage

      if (!userMessage) {
        // Autonomous request
        const prevGoal = this.taskQueue.getCurrentGoal()
        const completedTasks = this.taskQueue.getCompletedTasks()
        const failedTasks = this.taskQueue.getFailedTasks()

        let statusMessage = ''

        if (prevGoal) {
          statusMessage += `Previous goal: "${prevGoal}"\n`

          if (completedTasks.length > 0) {
            statusMessage += `✅ Completed: ${completedTasks.slice(-3).join(', ')}\n`
          }

          if (failedTasks.length > 0) {
            statusMessage += `❌ Failed: ${failedTasks.join(', ')}\n`

            // Detect repeated failures on same action
            const recentFailures = perception.recentFailures || []
            const failureActions = recentFailures.map(f => f.action)
            const actionCounts = failureActions.reduce((acc, action) => {
              acc[action] = (acc[action] || 0) + 1
              return acc
            }, {} as Record<string, number>)

            const repeatedAction = Object.entries(actionCounts).find(([_, count]) => count >= 3)

            if (repeatedAction) {
              const actionType = repeatedAction[0]
              statusMessage += `\n🚨 CRITICAL: "${actionType}" failed ${repeatedAction[1]} times!\n`
              statusMessage += `⚠️ STOP and REASSESS from the beginning!\n`
              statusMessage += `⚠️ You are probably missing a PREREQUISITE step OR trying something IMPOSSIBLE.\n`
              statusMessage += `⚠️ Ask yourself: What basic things do I need BEFORE attempting this?\n`
              statusMessage += `⚠️ Examples:\n`
              statusMessage += `   - Can't craft without crafting table? Do you HAVE one in inventory? Is it PLACED on ground?\n`
              statusMessage += `   - Can't mine without tool? Do you have the RIGHT tool? Is it EQUIPPED?\n`
              statusMessage += `   - Can't craft item? Do you have ALL materials including intermediate items?\n`

              // Special guidance for place failures
              if (actionType === 'place') {
                statusMessage += `   - Can't PLACE item? Check NEARBY RESOURCES - does it ALREADY EXIST nearby?\n`
                statusMessage += `   - If NEARBY shows "✓ crafting_table" - DON'T try to place another one!\n`
                statusMessage += `   - Read the error message - does it say "already exists nearby"? Then SKIP placing!\n`
              }

              statusMessage += `\n⚠️ CRITICAL: Try a DIFFERENT action, not the same one again!\n\n`
            } else {
              statusMessage += `\n⚠️ Some tasks failed - check if resources are unavailable or too far.\n`
            }
          }

          statusMessage += `\n`
        }

        statusMessage += `Check your INVENTORY carefully!\n`
        statusMessage += `Don't repeat tasks if you already have the materials.\n`
        statusMessage += `What should I do next?`

        userMessage = statusMessage
      }

      // Get plan from LLM (with timeout handling)
      let response: string
      try {
        response = await this.llmAgent.getNextAction(perception, userMessage)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[AIBot] ❌ LLM error:', errorMsg)

        if (username) {
          this.bot.chat('Sorry, I\'m thinking too long. I\'ll continue with what I was doing.')
        }
        return
      }

      // Parse plan
      const plan = this.planParser.parsePlan(response)

      if (!plan) {
        console.log('[AIBot] ⚠️  Failed to parse plan from LLM')

        if (username) {
          this.bot.chat('Sorry, I couldn\'t understand the plan. I\'ll continue exploring.')
        }
        return
      }

      // Load plan into queue
      this.taskQueue.loadPlan(plan)

      // Notify user if chat-triggered
      if (username) {
        this.bot.chat(`Sure! ${plan.goal}`)
      }

    } finally {
      this.isRequestingPlan = false
    }
  }

  /**
   * Handle chat message from player
   */
  private async handleChatMessage(username: string, message: string): Promise<void> {
    // Check if already processing a chat (prevent spam)
    if (this.isChatting) {
      console.log('[AIBot] 💬 Already processing chat, please wait...')
      return
    }

    try {
      this.isChatting = true

      // Format message for LLM
      const userMessage = `Player ${username} says: "${message}"\n\nRespond appropriately. If they ask you to do something, make a plan to achieve it.`

      console.log('[AIBot] 💬 Processing chat from', username)

      // Clear current queue and request new plan
      console.log('[AIBot] 🔄 Interrupting current plan for player request')
      this.taskQueue.clear()

      // Request new plan based on player message
      await this.requestNewPlan(userMessage, username)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[AIBot] ❌ Error handling chat:', errorMsg)
      this.bot.chat('Sorry, something went wrong.')
    } finally {
      this.isChatting = false
    }
  }

  /**
   * Get action description for logging
   */
  private getActionDescription(command: any): string {
    switch (command.type) {
      case 'mine':
        return command.blockType ? `mine ${command.blockType}` : `mine at coordinates`
      case 'move':
        return `move to (${command.x}, ${command.y}, ${command.z})`
      case 'craft':
        return `craft ${command.item}`
      case 'attack':
        return `attack ${command.target}`
      case 'toss':
        return command.player ? `toss ${command.item} to ${command.player}` : `toss ${command.item}`
      case 'follow':
        return `follow ${command.player}`
      case 'equip':
        return `equip ${command.item}`
      default:
        return command.type
    }
  }

  /**
   * Get failure context for better debugging
   */
  private getFailureContext(command: any): string {
    const pos = this.bot.entity.position
    return `at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`
  }

  /**
   * Get the underlying bot instance
   */
  public getBot(): Bot {
    return this.bot
  }
}

// Main entry point
if (require.main === module) {
  // Load environment variables
  require('dotenv').config()

  const botConfig: BotConfig = {
    host: process.env.MINECRAFT_HOST || '20.243.34.235',
    port: parseInt(process.env.MINECRAFT_PORT || '25565'),
    username: process.env.BOT_USERNAME || 'AIBot',
    version: process.env.MINECRAFT_VERSION || '1.21.9',
    auth: 'offline'
  }

  const llmConfig: LLMConfig = {
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '512'),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    personality: process.env.BOT_PERSONALITY || undefined,
    storedPromptId: process.env.LLM_STORED_PROMPT_ID || undefined
  }

  // Validate API key
  if (!llmConfig.apiKey) {
    console.error('❌ ERROR: LLM_API_KEY not set!')
    console.error('Please set it in .env file or environment variable')
    console.error('Example: export LLM_API_KEY=sk-...')
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('🤖 AI-Powered Minecraft Bot (Goal-Based System)')
  console.log('='.repeat(60))
  console.log('📡 Host:', botConfig.host)
  console.log('👤 Username:', botConfig.username)
  console.log('🧠 LLM Model:', llmConfig.model)
  console.log('🌡️  Temperature:', llmConfig.temperature)
  console.log('🎭 Personality:', llmConfig.personality || 'default')
  console.log('='.repeat(60))

  // Create and start bot
  new AIBot(botConfig, llmConfig)
}
