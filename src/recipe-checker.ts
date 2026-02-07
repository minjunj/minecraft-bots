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

    // Important items to check
    const importantItems = [
      'oak_planks', 'birch_planks', 'spruce_planks',
      'stick',
      'crafting_table',
      'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe',
      'wooden_axe', 'stone_axe', 'iron_axe',
      'wooden_shovel', 'stone_shovel', 'iron_shovel',
      'wooden_sword', 'stone_sword', 'iron_sword',
      'furnace',
      'chest',
      'torch'
    ]

    for (const itemName of importantItems) {
      const itemData = mcData.itemsByName[itemName]
      if (!itemData) continue

      // Use minecraft-data recipes directly (bot.recipesFor doesn't work in 1.21.9)
      const mcDataRecipes = mcData.recipes[itemData.id]
      if (!mcDataRecipes || mcDataRecipes.length === 0) continue

      // Check each recipe variant
      for (const recipeData of mcDataRecipes) {
        // Check if requires crafting table (3x3 shape)
        const requiresTable = recipeData.inShape && recipeData.inShape.length > 2
        if (requiresTable && !hasCraftingTable) continue

        // Check if we have all materials
        let canCraft = true
        const requirements: string[] = []

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
              break
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
              break
            }
          }
        }

        if (canCraft) {
          const reqStr = requirements.length > 0 ? ` (${requirements.join(' + ')})` : ''
          craftable.push(`ID ${itemData.id}: ${itemName}${reqStr}`)
          break // Found one craftable recipe, no need to check others
        }
      }
    }

    return craftable
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
