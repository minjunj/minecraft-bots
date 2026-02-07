import { PerceptionData, LLMConfig } from './types'
import { ContextBuilder } from './context-builder'
import { COMMAND_GRAMMAR } from './commands'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export class LLMAgent {
  private config: LLMConfig
  private contextBuilder: ContextBuilder
  private conversationHistory: OpenAIMessage[] = []
  private maxHistoryLength = 10

  constructor(config: LLMConfig, contextBuilder?: ContextBuilder) {
    this.config = config
    this.contextBuilder = contextBuilder || new ContextBuilder()
  }

  /**
   * Get next action from LLM
   */
  public async getNextAction(
    perception: PerceptionData,
    userMessage?: string
  ): Promise<string> {
    // Build context
    const context = this.contextBuilder.buildContext(perception)
    const systemPrompt = this.buildSystemPrompt()

    // Build user message
    let userPrompt = `Current Situation:\n${context}`

    if (userMessage) {
      userPrompt += `\n\nNew player message: "${userMessage}"`
    }

    userPrompt += `\n\n⚠️ CRITICAL: Respond ONLY with valid JSON in THIS EXACT FORMAT (no other fields allowed):
{
  "inventory_analysis": "string describing what you have",
  "goal": "string describing your final goal",
  "reasoning": "string explaining your approach",
  "plan": ["command1", "command2", "command3"]
}

If there were recent failures, add:
  "failure_analysis": "string explaining why failures occurred"

DO NOT use fields like "task", "next_steps", "action", or any other structure.
Commands in "plan" array must be exact strings like: "craft 36", "move 120 64 210", "mine stone 20"`

    console.log('[LLMAgent] Getting next action from LLM...')

    // Log LLM input
    const debugMode = process.env.LLM_DEBUG === 'true'
    console.log('[LLMAgent] ============ LLM INPUT ============')
    if (debugMode) {
      console.log('[LLMAgent] System Prompt:')
      console.log(systemPrompt)
      console.log('[LLMAgent] ---')
    } else {
      console.log('[LLMAgent] System Prompt Length:', systemPrompt.length, 'chars')
    }
    console.log('[LLMAgent] User Prompt:')
    console.log(userPrompt)
    console.log('[LLMAgent] ====================================')

    try {
      // Call OpenAI
      const response = await this.callOpenAI(systemPrompt, userPrompt)

      console.log('[LLMAgent] ============ LLM OUTPUT ===========')
      console.log('[LLMAgent] Response:', response)
      console.log('[LLMAgent] ======================================')

      return response
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[LLMAgent] Error:', errorMsg)

      // Return fallback command
      return 'wait 5000'
    }
  }

  /**
   * Call OpenAI API with timeout
   */
  private async callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Build messages
    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history
    messages.push(...this.conversationHistory)

    // Add current message
    messages.push({ role: 'user', content: userMessage })

    console.log('[LLMAgent] Calling OpenAI API...')
    console.log('[LLMAgent] Messages count:', messages.length)

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 30000) // 30 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4',
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 512,
          response_format: { type: 'json_object' },  // Force JSON output
          messages
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as OpenAIResponse
      const content = data.choices[0].message.content.trim()

      // Update conversation history
      this.conversationHistory.push({ role: 'user', content: userMessage })
      this.conversationHistory.push({ role: 'assistant', content })

      // Keep history limited
      if (this.conversationHistory.length > this.maxHistoryLength * 2) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2)
      }

      return content
    } catch (err) {
      clearTimeout(timeout)

      // Check if it was a timeout
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('LLM API timeout after 30 seconds')
      }

      throw err
    }
  }

  /**
   * Get personality prompt from config
   */
  private getPersonalityPrompt(): string {
    const personality = this.config.personality

    // If no personality specified, use default
    if (!personality) {
      return `## Your Personality
- Proactive and autonomous
- Helpful and responsive to players
- Goal-oriented but flexible
- Cautious about danger (hostile mobs, low health)`
    }

    // Use the custom personality text directly
    return `## Your Personality
${personality}`
  }

  /**
   * Build system prompt with goals and command grammar
   * Now uses OpenAI stored prompts for reduced token usage
   */
  private buildSystemPrompt(): string {
    // Stored prompt is required - throw error if not configured
    if (!this.config.storedPromptId) {
      throw new Error(
        'LLM_STORED_PROMPT_ID is required! Please set it in your .env file.\n' +
        'Get your stored prompt ID from OpenAI dashboard or create one with the full system prompt.'
      )
    }

    // Return minimal system message that references the stored prompt
    const personalityPrompt = this.getPersonalityPrompt()

    return `You are an AI agent controlling a Minecraft bot.

${personalityPrompt}

Follow all instructions from your stored prompt (ID: ${this.config.storedPromptId}).

CRITICAL: You MUST respond in valid JSON format as specified in the stored prompt. Never respond with plain text or explanations.`
  }

  /**
   * REMOVED: Full system prompt has been moved to OpenAI stored prompt
   * Old prompt was ~24,517 characters (~6000-7000 tokens)
   * New approach saves ~97% tokens per API call
   *
   * If you need to update the prompt:
   * 1. Go to OpenAI dashboard
   * 2. Update stored prompt: ${this.config.storedPromptId}
   * 3. Changes will apply immediately without code deployment
   */

  // LEGACY CODE REMOVED - The following sections are now in OpenAI stored prompt:
  // - Minecraft expertise and game knowledge
  // - Primary goals and decision making
  // - Critical failure handling (🚨 CRITICAL warnings)
  // - Learning from failures framework
  // - Situation awareness (EQUIPPED, INVENTORY, NEARBY RESOURCES)
  // - Command grammar and available commands
  // - Response format (JSON with inventory_analysis, failure_analysis, goal, reasoning, plan)
  // - 16 detailed examples showing correct and incorrect approaches
  // - Planning guidelines and prerequisite checking
  // - Common mistakes to avoid
  // - Step-by-step analysis framework
  // - Distance checking and crafting table placement logic
  //
  // Total removed: ~600 lines, ~24,000 characters

  /**
   * OLD buildSystemPrompt() implementation removed
   * Was a 600+ line method with full Minecraft bot instructions
   * Now using OpenAI stored prompts feature instead
   *
   * To restore if needed: check git history or STORED_PROMPT.md
   */

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = []
  }
}
