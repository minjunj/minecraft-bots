import { Bot } from 'mineflayer'
import { InventoryItem } from './types'

export class RecipeChecker {
  private bot: Bot

  constructor(bot: Bot) {
    this.bot = bot
  }

  /**
   * Get list of items that can be crafted with current inventory
   */
  public getCraftableItems(inventory: InventoryItem[]): string[] {
    const mcData = require('minecraft-data')(this.bot.version)
    const craftable: string[] = []
    const almostCraftable: string[] = []

    // Count what we have
    const itemCounts: { [key: string]: number } = {}
    for (const item of inventory) {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.count
    }

    // Check for crafting table nearby
    const hasCraftingTable = this.bot.findBlock({
      matching: (b) => b && b.name === 'crafting_table',
      maxDistance: 32
    }) !== null || itemCounts['crafting_table'] > 0

    // Priority items - show these first if craftable
    const priorityKeywords = [
      'pickaxe', 'axe', 'shovel', 'hoe', 'sword',  // Tools
      'planks', 'stick', 'torch',                   // Basic materials
      'crafting_table', 'furnace', 'chest',        // Infrastructure
      'iron_ingot', 'gold_ingot'                   // Smelted items
    ]

    const priorityItems: string[] = []
    const otherItems: string[] = []

    // Check ALL items with recipes (not just a hardcoded list)
    // This allows LLM to discover and use any craftable item based on situation
    for (const itemId in mcData.recipes) {
      const mcDataRecipes = mcData.recipes[itemId]
      if (!mcDataRecipes || mcDataRecipes.length === 0) continue

      const itemData = mcData.items[itemId]
      if (!itemData) continue

      const itemName = itemData.name

      // Check each recipe variant
      for (const recipeData of mcDataRecipes) {
        // Check if requires crafting table (3x3 shape)
        const requiresTable = recipeData.inShape && recipeData.inShape.length > 2
        if (requiresTable && !hasCraftingTable) continue

        // Check if we have all materials
        let canCraft = true
        const requirements: string[] = []
        const missing: string[] = []

        if (recipeData.inShape) {
          // Shaped recipe
          const required: { [key: number]: number } = {}
          for (const row of recipeData.inShape) {
            for (const ingredientId of row) {
              if (ingredientId !== null) {
                required[ingredientId] = (required[ingredientId] || 0) + 1
              }
            }
          }

          for (const [reqIdStr, reqCount] of Object.entries(required)) {
            const reqId = Number(reqIdStr)
            const reqItem = mcData.items[reqId]
            const havingCount = itemCounts[reqItem.name] || 0

            requirements.push(`${reqItem.name} x${reqCount}`)

            if (havingCount < reqCount) {
              canCraft = false
              missing.push(`${reqItem.name} x${reqCount - havingCount}`)
            }
          }
        } else if (recipeData.ingredients) {
          // Shapeless recipe
          const required: { [key: number]: number} = {}
          for (const ingredientId of recipeData.ingredients) {
            required[ingredientId] = (required[ingredientId] || 0) + 1
          }

          for (const [reqIdStr, reqCount] of Object.entries(required)) {
            const reqId = Number(reqIdStr)
            const reqItem = mcData.items[reqId]
            const havingCount = itemCounts[reqItem.name] || 0

            requirements.push(`${reqItem.name} x${reqCount}`)

            if (havingCount < reqCount) {
              canCraft = false
              missing.push(`${reqItem.name} x${reqCount - havingCount}`)
            }
          }
        }

        if (canCraft) {
          const reqStr = requirements.length > 0 ? ` (${requirements.join(' + ')})` : ''
          const craftableItem = `ID ${itemData.id}: ${itemName}${reqStr}`

          // Check if this is a priority item
          const isPriority = priorityKeywords.some(keyword => itemName.includes(keyword))

          if (isPriority) {
            priorityItems.push(craftableItem)
          } else {
            otherItems.push(craftableItem)
          }

          break // Found one craftable recipe, no need to check others
        } else if (missing.length > 0 && missing.length <= 2) {
          // Almost craftable - only 1-2 materials missing
          const isPriority = priorityKeywords.some(keyword => itemName.includes(keyword))

          if (isPriority) {
            const reqStr = requirements.length > 0 ? ` (need: ${missing.join(' + ')})` : ''
            almostCraftable.push(`ID ${itemData.id}: ${itemName}${reqStr}`)
          }

          break
        }
      }
    }

    // Return priority items first, then others, then almost craftable (limited to 30 total to avoid token overflow)
    const result = [...priorityItems, ...otherItems]

    // Add almost craftable section if there are items
    if (almostCraftable.length > 0) {
      result.push('') // Empty line separator
      result.push('ALMOST CRAFTABLE (need 1-2 more materials):')
      result.push(...almostCraftable.slice(0, 5)) // Limit to 5 almost craftable items
    }

    return result.slice(0, 35)
  }

  /**
   * Check if specific item can be crafted
   */
  public canCraft(itemName: string): { canCraft: boolean; reason: string } {
    const mcData = require('minecraft-data')(this.bot.version)
    const itemData = mcData.itemsByName[itemName]

    if (!itemData) {
      return { canCraft: false, reason: `Unknown item: ${itemName}` }
    }

    const recipes = this.bot.recipesFor(itemData.id, null, 1, null)
    if (!recipes || recipes.length === 0) {
      return { canCraft: false, reason: 'No recipe available' }
    }

    const recipe = recipes[0]

    // Check crafting table
    if (recipe.requiresTable) {
      const hasCraftingTable = this.bot.findBlock({
        matching: (b) => b && b.name === 'crafting_table',
        maxDistance: 32
      }) !== null

      if (!hasCraftingTable) {
        return { canCraft: false, reason: 'Requires crafting table (not found nearby)' }
      }
    }

    // Check materials
    const inventory = this.bot.inventory.items()
    const itemCounts: { [key: string]: number } = {}
    for (const item of inventory) {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.count
    }

    const missing: string[] = []

    if (recipe.delta) {
      for (const delta of recipe.delta) {
        if (delta.count < 0) {
          const requiredItem = mcData.items[delta.id]
          const requiredCount = -delta.count
          const havingCount = itemCounts[requiredItem.name] || 0

          if (havingCount < requiredCount) {
            missing.push(`${requiredItem.name} (need ${requiredCount}, have ${havingCount})`)
          }
        }
      }
    }

    if (missing.length > 0) {
      return { canCraft: false, reason: `Missing: ${missing.join(', ')}` }
    }

    return { canCraft: true, reason: 'All materials available' }
  }
}
