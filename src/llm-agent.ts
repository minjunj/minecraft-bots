import { PerceptionData, LLMConfig } from './types'
import { ContextBuilder } from './context-builder'
import * as fs from 'fs'
import * as path from 'path'

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
  private systemPrompt: string

  constructor(config: LLMConfig, contextBuilder?: ContextBuilder) {
    this.config = config
    this.contextBuilder = contextBuilder || new ContextBuilder()
    this.systemPrompt = this.buildSystemPrompt()
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

    // Log LLM input
    console.log('\n' + '='.repeat(80))
    console.log('📥 LLM INPUT:')
    console.log('-'.repeat(80))
    console.log(userPrompt)
    console.log('='.repeat(80))

    try {
      // Call OpenAI
      const response = await this.callOpenAI(this.systemPrompt, userPrompt)

      console.log('\n' + '='.repeat(80))
      console.log('📤 LLM OUTPUT:')
      console.log('-'.repeat(80))
      console.log(response)
      console.log('='.repeat(80) + '\n')

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
          max_completion_tokens: this.config.max_completion_tokens || 512,
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
   * Load specialization prompt from file or inline text
   */
  private loadSpecializationPrompt(): string {
    const specialization = this.config.specialization

    if (!specialization) {
      return ''
    }

    // Check if it's a file path (no newlines, looks like a path)
    if (!specialization.includes('\n') && specialization.length < 50) {
      // Try to load from specializations directory
      const specializationPath = path.join(__dirname, '..', 'specializations', `${specialization}.txt`)

      try {
        if (fs.existsSync(specializationPath)) {
          return fs.readFileSync(specializationPath, 'utf-8')
        } else {
          return specialization
        }
      } catch (err) {
        return specialization
      }
    }

    // Use inline text as specialization
    return specialization
  }

  /**
   * Build system prompt - only specialization (stored prompt is referenced by ID)
   */
  private buildSystemPrompt(): string {
    // Stored prompt is required - throw error if not configured
    if (!this.config.storedPromptId) {
      throw new Error(
        'LLM_STORED_PROMPT_ID is required! Please set it in your .env file.\n' +
        'The common prompt (DEVELOPER_MESSAGE.txt) should already be registered in OpenAI as a stored prompt.'
      )
    }

    // Load specialization prompt
    const specializationPrompt = this.loadSpecializationPrompt()

    // Only include specialization if provided (stored prompt handles the rest)
    return specializationPrompt || ''
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = []
  }
}
