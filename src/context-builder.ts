import { PerceptionData } from './types'
import { RecipeChecker } from './recipe-checker'

export class ContextBuilder {
  private recipeChecker: RecipeChecker | null = null

  /**
   * Set recipe checker (should be called once after bot spawns)
   */
  public setRecipeChecker(checker: RecipeChecker): void {
    this.recipeChecker = checker
  }
  /**
   * Build a concise text context for LLM
   */
  public buildContext(perception: PerceptionData): string {
    const sections: string[] = []

    // Bot status (concise)
    sections.push(this.buildStatusSection(perception))

    // Equipment (what's currently equipped)
    sections.push(this.buildEquipmentSection(perception))

    // Nearby resources
    if (perception.nearbyBlocks.length > 0) {
      sections.push(this.buildResourcesSection(perception))
    }

    // Threats and entities
    if (perception.nearbyEntities.length > 0) {
      sections.push(this.buildEntitiesSection(perception))
    }

    // Inventory summary
    sections.push(this.buildInventorySection(perception))

    // Craftable items based on inventory
    sections.push(this.buildCraftableSection(perception))

    // Recent chat
    if (perception.recentChat.length > 0) {
      sections.push(this.buildChatSection(perception))
    }

    // Recent failures
    if (perception.recentFailures.length > 0) {
      sections.push(this.buildFailuresSection(perception))
    }

    return sections.join('\n\n')
  }

  private buildStatusSection(perception: PerceptionData): string {
    const { botState, time } = perception
    const pos = botState.position

    const warnings: string[] = []
    if (botState.health < 10) warnings.push('⚠️ LOW HEALTH')
    if (botState.food < 10) warnings.push('⚠️ LOW FOOD')
    if (!time.isDay) warnings.push('🌙 NIGHT TIME (more dangerous)')

    const warningStr = warnings.length > 0 ? `\nWARNINGS: ${warnings.join(', ')}` : ''

    return `STATUS:
Position: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})
Health: ${botState.health.toFixed(1)}/20 | Food: ${botState.food}/20 | Level: ${botState.experience}${warningStr}`
  }

  private buildEquipmentSection(perception: PerceptionData): string {
    const { equipment } = perception.botState
    const mcData = require('minecraft-data')('1.21.9')

    const equipmentLines: string[] = []

    // Hand (most important for mining/combat)
    if (equipment.hand) {
      const itemData = mcData.itemsByName[equipment.hand]
      const itemId = itemData ? itemData.id : '?'
      equipmentLines.push(`  Hand: ${equipment.hand} (ID:${itemId})`)
    } else {
      equipmentLines.push(`  Hand: empty`)
    }

    // Armor
    const armorSlots = [
      { key: 'head' as const, label: 'Head' },
      { key: 'torso' as const, label: 'Torso' },
      { key: 'legs' as const, label: 'Legs' },
      { key: 'feet' as const, label: 'Feet' }
    ]

    const armorPieces: string[] = []
    for (const slot of armorSlots) {
      if (equipment[slot.key]) {
        const itemData = mcData.itemsByName[equipment[slot.key]!]
        const itemId = itemData ? itemData.id : '?'
        armorPieces.push(`${slot.label}:${equipment[slot.key]}(ID:${itemId})`)
      }
    }

    if (armorPieces.length > 0) {
      equipmentLines.push(`  Armor: ${armorPieces.join(', ')}`)
    }

    return equipmentLines.length > 0
      ? `EQUIPPED:\n${equipmentLines.join('\n')}`
      : 'EQUIPPED:\n  Nothing equipped'
  }

  private buildResourcesSection(perception: PerceptionData): string {
    const { nearbyBlocks } = perception

    // Group by type
    const groups = new Map<string, { count: number; closest: number }>()
    for (const block of nearbyBlocks) {
      const existing = groups.get(block.type)
      if (existing) {
        existing.count++
        existing.closest = Math.min(existing.closest, block.distance)
      } else {
        groups.set(block.type, { count: 1, closest: block.distance })
      }
    }

    // Sort by value (ores first, then by distance)
    const valueOrder: Record<string, number> = {
      'diamond_ore': 100,
      'iron_ore': 50,
      'gold_ore': 40,
      'coal_ore': 30,
      'crafting_table': 20,
      'furnace': 20,
      'chest': 15
    }

    const sorted = Array.from(groups.entries())
      .sort((a, b) => {
        const valA = valueOrder[a[0]] || 0
        const valB = valueOrder[b[0]] || 0
        if (valA !== valB) return valB - valA
        return a[1].closest - b[1].closest
      })
      .slice(0, 5)

    const resourceList = sorted
      .map(([type, data]) => {
        // Highlight important placed blocks
        const prefix = (type === 'crafting_table' || type === 'furnace' || type === 'chest') ? '✓ ' : '  '
        return `${prefix}${type}: ${data.count} found, closest at ${data.closest.toFixed(0)}m`
      })
      .join('\n')

    return `NEARBY RESOURCES:\n${resourceList}`
  }

  private buildEntitiesSection(perception: PerceptionData): string {
    const { nearbyEntities } = perception

    const players = nearbyEntities.filter(e => e.type === 'player')
    const hostileMobs = nearbyEntities.filter(e => e.type === 'mob' && e.isHostile)
    const passiveMobs = nearbyEntities.filter(e => e.type === 'mob' && !e.isHostile)

    const parts: string[] = []

    if (hostileMobs.length > 0) {
      const mobList = hostileMobs.slice(0, 3)
        .map(m => `${m.name} at ${m.distance.toFixed(0)}m`)
        .join(', ')
      parts.push(`⚠️ HOSTILE: ${mobList}`)
    }

    if (players.length > 0) {
      const playerList = players
        .map(p => `${p.name} at ${p.distance.toFixed(0)}m`)
        .join(', ')
      parts.push(`Players: ${playerList}`)
    }

    if (passiveMobs.length > 0 && parts.length < 2) {
      const mobList = passiveMobs.slice(0, 2)
        .map(m => `${m.name} at ${m.distance.toFixed(0)}m`)
        .join(', ')
      parts.push(`Mobs: ${mobList}`)
    }

    return parts.length > 0 ? `ENTITIES:\n  ${parts.join('\n  ')}` : ''
  }

  private buildInventorySection(perception: PerceptionData): string {
    const { inventory } = perception.botState

    if (inventory.length === 0) {
      return 'INVENTORY: Empty'
    }

    // Get minecraft-data to find item IDs
    const mcData = require('minecraft-data')('1.21.9')

    // Categorize items with clearer tuple format: (ID, count)
    const categories = {
      tools: [] as string[],
      materials: [] as string[],
      ores: [] as string[],
      food: [] as string[],
      other: [] as string[]
    }

    for (const item of inventory) {
      const name = item.name
      // Find item ID
      const itemData = mcData.itemsByName[name]
      const itemId = itemData ? itemData.id : '?'
      // Format: name (ID, count)
      const display = `${name}(${itemId}, ${item.count})`

      if (name.includes('pickaxe') || name.includes('sword') || name.includes('axe') ||
          name.includes('shovel') || name.includes('hoe')) {
        categories.tools.push(display)
      } else if (name.includes('_ore') || name === 'diamond' || name === 'emerald') {
        categories.ores.push(display)
      } else if (name.includes('beef') || name.includes('porkchop') || name.includes('bread') ||
                 name.includes('apple') || name.includes('carrot') || name.includes('potato') ||
                 name.includes('chicken')) {
        categories.food.push(display)
      } else if (name.includes('log') || name.includes('plank') || name === 'stick' ||
                 name.includes('cobblestone') || name.includes('stone') ||
                 name.includes('ingot') || name === 'coal') {
        categories.materials.push(display)
      } else {
        categories.other.push(display)
      }
    }

    // Build output
    const lines: string[] = [`INVENTORY (${inventory.length} item types):`]

    if (categories.tools.length > 0) {
      lines.push(`  Tools: ${categories.tools.join(', ')}`)
    }
    if (categories.materials.length > 0) {
      lines.push(`  Materials: ${categories.materials.join(', ')}`)
    }
    if (categories.ores.length > 0) {
      lines.push(`  Ores: ${categories.ores.join(', ')}`)
    }
    if (categories.food.length > 0) {
      lines.push(`  Food: ${categories.food.join(', ')}`)
    }
    if (categories.other.length > 0) {
      lines.push(`  Other: ${categories.other.join(', ')}`)
    }

    return lines.join('\n')
  }

  private buildChatSection(perception: PerceptionData): string {
    const { recentChat } = perception

    const chatList = recentChat
      .slice(-3) // Last 3 messages
      .map(msg => `  [${msg.username}]: ${msg.message}`)
      .join('\n')

    return `RECENT CHAT:\n${chatList}`
  }

  private buildFailuresSection(perception: PerceptionData): string {
    const { recentFailures } = perception

    const failureList = recentFailures
      .slice(-5) // Last 5 failures
      .map(fail => {
        const elapsed = Math.floor((Date.now() - fail.timestamp) / 1000)
        const contextStr = fail.context ? ` (${fail.context})` : ''
        return `  [${elapsed}s ago] ${fail.action} failed: ${fail.reason}${contextStr}`
      })
      .join('\n')

    return `⚠️ RECENT FAILURES (learn from these!):\n${failureList}`
  }

  private buildCraftableSection(perception: PerceptionData): string {
    // Use real recipe checker if available
    if (this.recipeChecker) {
      const craftable = this.recipeChecker.getCraftableItems(perception.botState.inventory)

      if (craftable.length === 0) {
        return `CRAFTABLE:\n  Nothing yet - need materials`
      }

      return `CRAFTABLE:\n  ${craftable.join('\n  ')}`
    }

    // Fallback to old logic if recipe checker not set
    return `CRAFTABLE:\n  (Recipe checker not initialized)`
  }
}
