import { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import {
  PerceptionData,
  BotState,
  NearbyBlock,
  NearbyEntity,
  ChatMessage,
  InventoryItem,
  Equipment,
  FailureLog
} from './types'
import { RecipeChecker } from './recipe-checker'

export class PerceptionSystem {
  private bot: Bot
  private chatHistory: ChatMessage[] = []
  private failureHistory: FailureLog[] = []
  private maxChatHistory = 10
  private maxFailureHistory = 5
  private perceptionRadius = 32
  private recipeChecker: RecipeChecker

  constructor(bot: Bot) {
    this.bot = bot
    this.recipeChecker = new RecipeChecker(bot)
    this.setupChatListener()
  }

  private setupChatListener(): void {
    this.bot.on('chat', (username: string, message: string) => {
      if (username === this.bot.username) return

      this.chatHistory.push({
        username,
        message,
        timestamp: Date.now()
      })

      // Keep only recent messages
      if (this.chatHistory.length > this.maxChatHistory) {
        this.chatHistory.shift()
      }
    })
  }

  /**
   * Add a failure log entry
   */
  public logFailure(action: string, reason: string, context?: string): void {
    this.failureHistory.push({
      action,
      reason,
      timestamp: Date.now(),
      context
    })

    // Keep only recent failures
    if (this.failureHistory.length > this.maxFailureHistory) {
      this.failureHistory.shift()
    }

  }

  /**
   * Get recent failure logs
   */
  private getRecentFailures(): FailureLog[] {
    return [...this.failureHistory]
  }

  /**
   * Gather all perception data about the current environment
   */
  public gatherPerceptionData(currentGoal?: string): PerceptionData {
    return {
      botState: this.getBotState(),
      nearbyBlocks: this.getNearbyBlocks(),
      nearbyEntities: this.getNearbyEntities(),
      recentChat: this.getRecentChat(),
      recentFailures: this.getRecentFailures(),
      currentGoal,
      time: this.getTimeInfo()
    }
  }

  /**
   * Get bot's internal state
   */
  private getBotState(): BotState {
    return {
      position: this.bot.entity.position.clone(),
      health: this.bot.health,
      food: this.bot.food,
      inventory: this.getInventory(),
      equipment: this.getEquipment(),
      experience: this.bot.experience.level
    }
  }

  /**
   * Get inventory items
   */
  private getInventory(): InventoryItem[] {
    return this.bot.inventory.items().map(item => ({
      name: item.name,
      count: item.count,
      slot: item.slot
    }))
  }

  /**
   * Get equipped items
   */
  private getEquipment(): Equipment {
    const destinations = ['hand', 'head', 'torso', 'legs', 'feet'] as const
    const equipment: Equipment = {}

    for (const dest of destinations) {
      const item = this.bot.inventory.slots[this.bot.getEquipmentDestSlot(dest)]
      if (item) {
        equipment[dest] = item.name
      }
    }

    return equipment
  }

  /**
   * Get nearby interesting blocks
   */
  private getNearbyBlocks(): NearbyBlock[] {
    const interestingBlocks = [
      'diamond_ore', 'iron_ore', 'coal_ore', 'gold_ore',
      'crafting_table', 'furnace', 'chest',
      'oak_log', 'birch_log', 'spruce_log',
      'stone', 'cobblestone'
    ]

    const nearbyBlocks: NearbyBlock[] = []
    const botPos = this.bot.entity.position

    for (const blockType of interestingBlocks) {
      try {
        const blocks = this.bot.findBlocks({
          matching: (block) => block && block.name === blockType,
          maxDistance: this.perceptionRadius,
          count: 5 // Limit to 5 of each type
        })

        for (const blockPos of blocks) {
          const block = this.bot.blockAt(blockPos)
          if (block) {
            nearbyBlocks.push({
              type: block.name,
              position: blockPos,
              distance: botPos.distanceTo(blockPos)
            })
          }
        }
      } catch (err) {
        // Skip if block type not found
      }
    }

    // Sort by distance
    return nearbyBlocks.sort((a, b) => a.distance - b.distance).slice(0, 20)
  }

  /**
   * Get nearby entities (players, mobs, items)
   */
  private getNearbyEntities(): NearbyEntity[] {
    const botPos = this.bot.entity.position
    const nearbyEntities: NearbyEntity[] = []

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.id === this.bot.entity.id) continue

      const distance = botPos.distanceTo(entity.position)
      if (distance > this.perceptionRadius) continue

      nearbyEntities.push({
        type: entity.type,
        name: entity.name || entity.username || entity.displayName,
        position: entity.position.clone(),
        distance,
        isHostile: this.isHostile(entity),
        health: (entity as any).health
      })
    }

    // Sort by distance
    return nearbyEntities.sort((a, b) => a.distance - b.distance).slice(0, 20)
  }

  /**
   * Check if entity is hostile
   */
  private isHostile(entity: any): boolean {
    const hostileMobs = [
      'zombie', 'skeleton', 'spider', 'creeper',
      'enderman', 'witch', 'slime', 'phantom'
    ]

    const mobType = entity.displayName || entity.name?.toLowerCase() || ''
    return hostileMobs.some(hostile => mobType.toLowerCase().includes(hostile))
  }

  /**
   * Get recent chat messages
   */
  private getRecentChat(): ChatMessage[] {
    return [...this.chatHistory]
  }

  /**
   * Get time of day information
   */
  private getTimeInfo() {
    const timeOfDay = this.bot.time.timeOfDay
    const isDay = timeOfDay < 13000 || timeOfDay > 23000

    return {
      timeOfDay,
      isDay
    }
  }

  /**
   * Clear chat history
   */
  public clearChatHistory(): void {
    this.chatHistory = []
  }

  /**
   * Clear failure history
   */
  public clearFailureHistory(): void {
    this.failureHistory = []
  }

  /**
   * Get recipe checker
   */
  public getRecipeChecker(): RecipeChecker {
    return this.recipeChecker
  }
}
