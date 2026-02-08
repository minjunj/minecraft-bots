import { Bot } from 'mineflayer'
import { Movements, goals } from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'
import { Command } from './commands'
import { Item } from 'prismarine-item'
const Recipe = require('prismarine-recipe')('1.21.9').Recipe

const { GoalNear, GoalFollow } = goals

export class ActionExecutor {
  private bot: Bot
  private followingPlayer: string | null = null
  private lastError: string = ''

  // Tool materials in priority order (best to worst)
  private readonly TOOL_MATERIALS = ['diamond', 'iron', 'stone', 'wooden']

  // Block mining requirements
  private readonly MINING_REQUIREMENTS: { [key: string]: string[] } = {
    'stone': ['wooden', 'stone', 'iron', 'diamond'],
    'cobblestone': ['wooden', 'stone', 'iron', 'diamond'],
    'coal_ore': ['wooden', 'stone', 'iron', 'diamond'],
    'copper_ore': ['stone', 'iron', 'diamond'],
    'iron_ore': ['stone', 'iron', 'diamond'],
    'lapis_ore': ['stone', 'iron', 'diamond'],
    'gold_ore': ['iron', 'diamond'],
    'redstone_ore': ['iron', 'diamond'],
    'diamond_ore': ['iron', 'diamond'],
    'emerald_ore': ['iron', 'diamond'],
    'obsidian': ['diamond'],
    'deepslate': ['wooden', 'stone', 'iron', 'diamond'],
    'deepslate_coal_ore': ['wooden', 'stone', 'iron', 'diamond'],
    'deepslate_copper_ore': ['stone', 'iron', 'diamond'],
    'deepslate_iron_ore': ['stone', 'iron', 'diamond'],
    'deepslate_lapis_ore': ['stone', 'iron', 'diamond'],
    'deepslate_gold_ore': ['iron', 'diamond'],
    'deepslate_redstone_ore': ['iron', 'diamond'],
    'deepslate_diamond_ore': ['iron', 'diamond'],
    'deepslate_emerald_ore': ['iron', 'diamond']
  }

  constructor(bot: Bot) {
    this.bot = bot
  }

  /**
   * Try to escape stuck situation by breaking nearby blocks
   */
  private async tryEscapeStuck(): Promise<boolean> {
    console.log('[ActionExecutor] 🚨 Attempting to escape stuck situation...')

    const botPos = this.bot.entity.position

    // Try to break blocks around the bot
    const offsets = [
      { x: 0, y: 0, z: 0 },   // Current block
      { x: 0, y: 1, z: 0 },   // Above
      { x: 1, y: 0, z: 0 },   // Front
      { x: -1, y: 0, z: 0 },  // Back
      { x: 0, y: 0, z: 1 },   // Right
      { x: 0, y: 0, z: -1 },  // Left
    ]

    for (const offset of offsets) {
      const checkPos = botPos.offset(offset.x, offset.y, offset.z)
      const block = this.bot.blockAt(checkPos)

      if (block && block.name !== 'air' && this.bot.canDigBlock(block)) {
        // Skip bedrock and other unbreakable blocks
        if (block.name === 'bedrock' || block.name === 'barrier') continue

        console.log(`[ActionExecutor] Breaking ${block.name} to escape`)
        try {
          await this.bot.dig(block)
          return true
        } catch (err) {
          // Continue to next block
          continue
        }
      }
    }

    console.log('[ActionExecutor] ❌ Could not find blocks to break for escape')
    return false
  }

  /**
   * Get the last error message
   */
  public getLastError(): string {
    return this.lastError
  }

  /**
   * Execute a command
   */
  public async execute(command: Command): Promise<boolean> {
    this.lastError = '' // Reset error

    // Log command execution
    const cmdDesc = this.formatCommandDescription(command)
    console.log(`🎯 ${cmdDesc}`)

    try {
      let result: boolean

      switch (command.type) {
        case 'move':
          result = await this.executeMove(command)
          break
        case 'look':
          result = await this.executeLook(command)
          break
        case 'attack':
          result = await this.executeAttack(command)
          break
        case 'mine':
          result = await this.executeMine(command)
          break
        case 'place':
          result = await this.executePlace(command)
          break
        case 'craft':
          result = await this.executeCraft(command)
          break
        case 'equip':
          result = await this.executeEquip(command)
          break
        case 'eat':
          result = await this.executeEat()
          break
        case 'chat':
          result = this.executeChat(command)
          break
        case 'wait':
          result = await this.executeWait(command)
          break
        case 'follow':
          result = this.executeFollow(command)
          break
        case 'stop_follow':
          result = this.executeStopFollow()
          break
        case 'toss':
          result = await this.executeToss(command)
          break
        default:
          this.lastError = 'Unknown command type'
          result = false
      }

      if (result) {
        console.log(`   ✅ Success`)
      } else {
        console.log(`   ❌ Failed: ${this.lastError}`)
      }

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      this.lastError = errorMsg
      console.log(`   ❌ Error: ${errorMsg}`)
      return false
    }
  }

  /**
   * Format command for logging
   */
  private formatCommandDescription(command: Command): string {
    switch (command.type) {
      case 'move':
        return `move (${command.x}, ${command.y}, ${command.z})`
      case 'mine':
        return command.blockType
          ? `mine ${command.count || 1}x ${command.blockType}`
          : `mine at (${command.x}, ${command.y}, ${command.z})`
      case 'craft':
        return `craft ${command.count || 1}x ${command.item}`
      case 'place':
        return `place ${command.block} at (${command.x}, ${command.y}, ${command.z})`
      case 'equip':
        return `equip ${command.item} to ${command.destination || 'hand'}`
      case 'attack':
        return `attack ${command.target}`
      case 'follow':
        return `follow ${command.player}`
      case 'toss':
        return `toss ${command.count || 1}x ${command.item}`
      case 'chat':
        return `chat "${command.message}"`
      default:
        return command.type
    }
  }

  private async executeMove(command: Command & { type: 'move' }): Promise<boolean> {
    const { x, y, z } = command

    // Check if already at or very close to target
    const currentPos = this.bot.entity.position
    const targetPos = new Vec3(x, y, z)
    const distance = currentPos.distanceTo(targetPos)

    if (distance < 2) {
      console.log(`[ActionExecutor] ℹ️  Already at target location (distance: ${distance.toFixed(1)}m)`)
      this.lastError = `Already at or near (${x}, ${y}, ${z}). Current position: (${Math.floor(currentPos.x)}, ${Math.floor(currentPos.y)}, ${Math.floor(currentPos.z)})`
      return false // Don't waste time moving
    }

    console.log(`[ActionExecutor] 🚶 Moving from (${Math.floor(currentPos.x)}, ${Math.floor(currentPos.y)}, ${Math.floor(currentPos.z)}) to (${x}, ${y}, ${z}) [${distance.toFixed(1)}m]`)

    this.followingPlayer = null
    const movements = new Movements(this.bot)
    movements.canDig = true // Allow digging through blocks
    movements.maxDropDown = 4 // Allow dropping down
    movements.allow1by1towers = false // Prevent pillar jumping (often gets stuck)
    this.bot.pathfinder.setMovements(movements)

    // Track pathfinding status
    let pathfindingFailed = false
    let goalReached = false
    let lastPosition = this.bot.entity.position.clone()
    let stuckCounter = 0

    const goalReachedHandler = () => {
      goalReached = true
    }

    // Only handle noPath status (not all path_update events!)
    const pathFindFailedHandler = (result: any) => {
      if (result.status === 'noPath') {
        pathfindingFailed = true
        this.lastError = `Cannot reach (${x}, ${y}, ${z}) - no path found`
      }
    }

    this.bot.once('goal_reached', goalReachedHandler)
    this.bot.on('path_update', pathFindFailedHandler)

    try {
      const goal = new GoalNear(x, y, z, 1)
      this.bot.pathfinder.setGoal(goal)

      // Wait for either success, failure, or timeout
      const startTime = Date.now()
      const timeout = 15000 // 15 seconds (increased from 10s)

      while (!goalReached && !pathfindingFailed && (Date.now() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 500))

        // Check if we're close enough
        const distance = this.bot.entity.position.distanceTo(new Vec3(x, y, z))
        if (distance < 2) {
          goalReached = true
          break
        }

        // Check if bot is stuck (not moving)
        const currentPosition = this.bot.entity.position.clone()
        const moved = currentPosition.distanceTo(lastPosition)

        if (moved < 0.5) {
          stuckCounter++
          if (stuckCounter >= 6) { // Stuck for 3 seconds (6 * 500ms)
            console.log(`[ActionExecutor] ⚠️ Bot appears stuck at ${currentPosition.toString()}`)

            // Try to escape by breaking blocks
            const escaped = await this.tryEscapeStuck()
            if (escaped) {
              console.log('[ActionExecutor] ✅ Escaped! Continuing movement...')
              stuckCounter = 0 // Reset and continue
            } else {
              // Give up after failed escape attempt
              this.lastError = `Movement stuck - bot is trapped and cannot escape`
              pathfindingFailed = true
              break
            }
          }
        } else {
          stuckCounter = 0 // Reset if bot is moving
        }

        lastPosition = currentPosition
      }

      // Cleanup
      this.bot.pathfinder.setGoal(null)
      this.bot.removeListener('goal_reached', goalReachedHandler)
      this.bot.removeListener('path_update', pathFindFailedHandler)

      if (goalReached) {
        return true
      }

      if (pathfindingFailed) {
        return false
      }

      // Timeout
      this.lastError = `Movement timeout - could not reach (${x}, ${y}, ${z}) in 15 seconds`
      return false

    } catch (err) {
      // Cleanup on error
      this.bot.pathfinder.setGoal(null)
      this.bot.removeListener('goal_reached', goalReachedHandler)
      this.bot.removeListener('path_update', pathFindFailedHandler)

      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      this.lastError = `Movement failed: ${errorMsg}`
      return false
    }
  }

  private async executeLook(command: Command & { type: 'look' }): Promise<boolean> {
    const { target, name, x, y, z } = command

    if (target === 'position' && x !== undefined && y !== undefined && z !== undefined) {
      const pos = new Vec3(x, y, z)
      await this.bot.lookAt(pos)
      return true
    }

    if (target === 'player' && name) {
      const player = this.bot.players[name]?.entity
      if (player) {
        await this.bot.lookAt(player.position.offset(0, player.height, 0))
        return true
      } else {
        console.log(`[ActionExecutor] Player ${name} not found`)
        return false
      }
    }

    if (target === 'entity' && name) {
      const entity = Object.values(this.bot.entities).find(e =>
        e.name?.toLowerCase().includes(name.toLowerCase()) ||
        e.displayName?.toLowerCase().includes(name.toLowerCase())
      )

      if (entity) {
        await this.bot.lookAt(entity.position.offset(0, entity.height / 2, 0))
        return true
      } else {
        console.log(`[ActionExecutor] Entity ${name} not found`)
        return false
      }
    }

    return false
  }

  private async executeAttack(command: Command & { type: 'attack' }): Promise<boolean> {
    const { target } = command

    let entity

    if (target.toLowerCase() === 'nearest') {
      // Find nearest hostile mob
      const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman']
      entity = Object.values(this.bot.entities)
        .filter(e => {
          const mobType = e.name?.toLowerCase() || ''
          return hostileMobs.some(hostile => mobType.includes(hostile))
        })
        .sort((a, b) =>
          this.bot.entity.position.distanceTo(a.position) -
          this.bot.entity.position.distanceTo(b.position)
        )[0]
    } else {
      // Find specific entity
      entity = Object.values(this.bot.entities).find(e =>
        e.name?.toLowerCase().includes(target.toLowerCase()) ||
        e.displayName?.toLowerCase().includes(target.toLowerCase())
      )
    }

    if (!entity) {
      console.log(`[ActionExecutor] Target ${target} not found`)
      return false
    }


    try {
      // Look at target
      await this.bot.lookAt(entity.position.offset(0, entity.height / 2, 0))

      // Attack with timeout
      await Promise.race([
        this.bot.attack(entity),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Attack timeout')), 5000))
      ])

      return true
    } catch (err) {
      console.log('[ActionExecutor] Attack failed:', err instanceof Error ? err.message : err)
      return false
    }
  }

  private async executeMine(command: Command & { type: 'mine' }): Promise<boolean> {
    const { x, y, z, blockType, count } = command

    // Case 1: Mine by exact coordinates
    if (x !== undefined && y !== undefined && z !== undefined) {
      return await this.mineAtPosition(x, y, z)
    }

    // Case 2: Mine by block type
    if (blockType) {
      return await this.mineBlockType(blockType, count || 1)
    }

    return false
  }

  private async mineAtPosition(x: number, y: number, z: number): Promise<boolean> {
    const pos = new Vec3(x, y, z)
    const block = this.bot.blockAt(pos)

    if (!block || block.name === 'air') {
      return false
    }


    try {
      // Ensure we have the proper tool
      const hasProperTool = await this.ensureProperTool(block.name)
      if (!hasProperTool) {
        this.lastError = `Cannot mine ${block.name} - missing required tool`
        return false
      }

      // Move close if needed
      const distance = this.bot.entity.position.distanceTo(pos)
      if (distance > 4) {
        const movements = new Movements(this.bot)
        this.bot.pathfinder.setMovements(movements)
        await Promise.race([
          this.bot.pathfinder.goto(new GoalNear(x, y, z, 3)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pathfinding timeout')), 5000))
        ])
      }

      // Verify block still exists
      const blockToMine = this.bot.blockAt(pos)
      if (!blockToMine || blockToMine.name === 'air') {
        this.lastError = 'Block disappeared'
        return false
      }

      // Check if bot can dig this block
      if (!this.bot.canDigBlock(blockToMine)) {
        this.lastError = `Cannot dig ${blockToMine.name} - wrong tool or unreachable`
        return false
      }

      // Get inventory count before mining
      const inventoryBefore = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)

      // Remember position where block was
      const dropPosition = blockToMine.position.clone()

      // Mine block with timeout (reduced from 15s to 5s)
      await Promise.race([
        this.bot.dig(blockToMine),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mining timeout')), 5000))
      ])

      // Try to collect dropped items
      const collected = await this.collectNearbyItems(dropPosition, inventoryBefore)

      if (!collected) {
        this.lastError = `Mined ${blockToMine.name} but failed to collect items`
        return false
      }

      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      this.lastError = `Mining failed: ${errorMsg}`
      return false
    }
  }

  private async mineBlockType(blockType: string, targetCount: number): Promise<boolean> {
    // Handle special cases
    // "stone" drops "cobblestone" when mined
    if (blockType === 'stone') {
      console.log(`[ActionExecutor] Note: stone drops cobblestone when mined`)
      blockType = 'cobblestone'
    }

    // Ensure we have proper tool before starting
    const hasProperTool = await this.ensureProperTool(blockType)
    if (!hasProperTool) {
      // Simple error message - let LLM figure out the solution from specialization
      const requiredMaterials = this.MINING_REQUIREMENTS[blockType]
      if (requiredMaterials) {
        this.lastError = `Cannot mine ${blockType} - need ${requiredMaterials[0]}_pickaxe or better`
        console.log(`[ActionExecutor] ❌ ${this.lastError}`)
      } else {
        this.lastError = `Cannot mine ${blockType} - missing required tool`
      }
      return false
    }

    let minedCount = 0

    for (let i = 0; i < targetCount; i++) {
      try {
        // Find nearest block of this type
        const block = this.bot.findBlock({
          matching: (b) => b && b.name === blockType,
          maxDistance: 32
        })

        if (!block) {
          this.lastError = minedCount > 0 ? '' : `No ${blockType} found nearby`
          break
        }

        // Move to block
        const distance = this.bot.entity.position.distanceTo(block.position)
        if (distance > 4) {
          const movements = new Movements(this.bot)
          this.bot.pathfinder.setMovements(movements)
          await Promise.race([
            this.bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 3)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pathfinding timeout')), 5000))
          ])
        }

        // Verify block still exists
        const blockToMine = this.bot.blockAt(block.position)
        if (!blockToMine || blockToMine.name === 'air') {
          continue // Skip and try next block
        }

        // Check if bot can dig this block
        if (!this.bot.canDigBlock(blockToMine)) {
          const handItem = this.bot.inventory.slots[this.bot.getEquipmentDestSlot('hand')]
          const currentTool = handItem ? handItem.name : 'hand (empty)'
          this.lastError = `Cannot dig ${blockType} at (${blockToMine.position.x}, ${blockToMine.position.y}, ${blockToMine.position.z}) - current tool: ${currentTool}. Need proper pickaxe!`
          console.log(`[ActionExecutor] ❌ ${this.lastError}`)
          return false
        }

        // Get inventory count before mining
        const inventoryBefore = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)

        // Remember position where block was
        const dropPosition = blockToMine.position.clone()

        console.log(`[ActionExecutor] ⛏️  Mining ${blockType} at (${blockToMine.position.x}, ${blockToMine.position.y}, ${blockToMine.position.z})`)

        // Mine block with timeout (reduced from 15s to 5s)
        await Promise.race([
          this.bot.dig(blockToMine),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mining timeout')), 5000))
        ])

        // Try to collect dropped items
        const collected = await this.collectNearbyItems(dropPosition, inventoryBefore)

        if (collected) {
          minedCount++
          console.log(`[ActionExecutor] ✅ Mined ${minedCount}/${targetCount} ${blockType}`)
        } else {
          console.log(`[ActionExecutor] ⚠️ Failed to collect dropped items, trying next block...`)
          // Failed to collect, try next block
          continue
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.log(`[ActionExecutor] ⚠️ Mining error: ${errorMsg}, trying next block...`)
        // Continue to next block on error (timeout, pathfinding failure, etc.)
        continue
      }
    }

    if (minedCount === 0) {
      this.lastError = this.lastError || `Failed to mine any ${blockType} (tried ${targetCount} times)`
      console.log(`[ActionExecutor] ❌ ${this.lastError}`)
    }

    return minedCount > 0
  }

  private async executePlace(command: Command & { type: 'place' }): Promise<boolean> {
    let { block, x, y, z } = command

    // Auto-generate coordinates if not provided (marker: -999)
    if (x === -999 || y === -999 || z === -999) {
      const botPos = this.bot.entity.position
      x = Math.floor(botPos.x) + 1
      y = Math.floor(botPos.y)
      z = Math.floor(botPos.z)
    }

    // Convert block to name if it's an ID
    const mcData = require('minecraft-data')(this.bot.version)
    let blockName: string

    if (typeof block === 'number') {
      const blockData = mcData.blocks[block]
      if (!blockData) {
        this.lastError = `Unknown block ID: ${block}`
        console.log(`[ActionExecutor] ❌ Unknown block ID: ${block}`)
        return false
      }
      blockName = blockData.name
    } else {
      blockName = block
    }

    // Check if this block type already exists nearby
    const existingBlock = this.bot.findBlock({
      matching: (b) => b && b.name === blockName,
      maxDistance: 32
    })

    if (existingBlock && blockName === 'crafting_table') {
      const distance = this.bot.entity.position.distanceTo(existingBlock.position)
      this.lastError = `${blockName} already exists nearby (${distance.toFixed(1)}m away). Don't place another one - use the existing one!`
      console.log(`[ActionExecutor] ❌ ${blockName} already exists at ${distance.toFixed(1)}m away`)
      console.log(`[ActionExecutor] No need to place another one`)
      return false
    }

    // Find block in inventory (match by name)
    const item = this.bot.inventory.items().find(i => i.name === blockName)

    if (!item) {
      this.lastError = `${blockName} not in inventory. Cannot place it.`
      console.log(`[ActionExecutor] ❌ ${blockName} not in inventory`)
      return false
    }

    const pos = new Vec3(x, y, z)
    const targetBlock = this.bot.blockAt(pos)

    if (!targetBlock) {
      this.lastError = `Cannot place at (${x}, ${y}, ${z}). Position is out of world or too far away.`
      console.log(`[ActionExecutor] ❌ Cannot place at (${x}, ${y}, ${z})`)
      return false
    }

    console.log(`[ActionExecutor] Placing ${blockName} at (${x}, ${y}, ${z})`)

    try {
      // Equip block
      await this.bot.equip(item, 'hand')

      // Place block
      await this.bot.placeBlock(targetBlock, new Vec3(0, 1, 0))

      console.log(`[ActionExecutor] ✅ Placed ${blockName}`)
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.lastError = `Cannot place ${blockName} at (${x}, ${y}, ${z}). ${errorMsg}. Try different coordinates or check if space is occupied.`
      console.log(`[ActionExecutor] ❌ Placing failed: ${errorMsg}`)
      return false
    }
  }

  private async executeCraft(command: Command & { type: 'craft' }): Promise<boolean> {
    let { item, count = 1 } = command


    try {
      const mcData = require('minecraft-data')(this.bot.version)

      let itemId: number
      let itemName: string

      // If item is already a number (ID), use it directly
      if (typeof item === 'number') {
        itemId = item
        const itemData = mcData.items[itemId]
        if (!itemData) {
          console.log(`[ActionExecutor] ❌ Unknown item ID: ${itemId}`)
          return false
        }
        itemName = itemData.name
        console.log(`[ActionExecutor] Using item ID ${itemId} (${itemName})`)
      } else {
        // Item is a string name, try to find it
        let itemData = mcData.itemsByName[item]

        // If not found, try common variations
        if (!itemData) {
          const variations = [
            item.replace('_', ''),           // oak_log → oaklog
            item + 's',                       // plank → planks
            item.slice(0, -1),               // planks → plank
            'minecraft:' + item              // Add namespace
          ]

          for (const variation of variations) {
            itemData = mcData.itemsByName[variation]
            if (itemData) {
              console.log(`[ActionExecutor] Found item as: ${variation}`)
              break
            }
          }
        }

        if (!itemData) {
          console.log(`[ActionExecutor] ❌ Unknown item name: ${item}`)
          console.log(`[ActionExecutor] Hint: Use item ID instead (e.g., craft 38 for birch_planks)`)
          return false
        }

        itemId = itemData.id
        itemName = itemData.name
      }

      // Get recipes from minecraft-data (bot.recipesFor doesn't work in 1.21.9)
      const mcDataRecipes = mcData.recipes[itemId]

      if (!mcDataRecipes || mcDataRecipes.length === 0) {
        console.log(`[ActionExecutor] ❌ No recipe for ${itemName} (ID: ${itemId})`)
        return false
      }

      // Find a recipe we can actually craft (check inventory)
      const inventory = this.bot.inventory.items()
      const inventoryCounts: { [key: number]: number } = {}
      for (const invItem of inventory) {
        const invItemData = mcData.itemsByName[invItem.name]
        if (invItemData) {
          inventoryCounts[invItemData.id] = (inventoryCounts[invItemData.id] || 0) + invItem.count
        }
      }

      let selectedRecipeData = null
      for (const recipeData of mcDataRecipes) {
        // Check if we have required ingredients
        let canCraft = true

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

          for (const [reqId, reqCount] of Object.entries(required)) {
            if ((inventoryCounts[Number(reqId)] || 0) < reqCount) {
              canCraft = false
              break
            }
          }
        } else if (recipeData.ingredients) {
          // Shapeless recipe
          for (const ingredientId of recipeData.ingredients) {
            if ((inventoryCounts[ingredientId] || 0) < 1) {
              canCraft = false
              break
            }
          }
        }

        if (canCraft) {
          selectedRecipeData = recipeData
          break
        }
      }

      if (!selectedRecipeData) {
        console.log(`[ActionExecutor] ❌ No craftable recipe for ${itemName} - missing materials`)
        return false
      }

      // Create Recipe object from minecraft-data
      const recipe = new Recipe(selectedRecipeData)
      console.log(`[ActionExecutor] Found recipe for ${itemName}`)

      // Check materials
      console.log(`[ActionExecutor] Recipe requires:`)
      if (recipe.delta) {
        for (const delta of recipe.delta) {
          const deltaItem = mcData.items[delta.id]
          console.log(`[ActionExecutor]   ${deltaItem?.name || delta.id} x${-delta.count}`)
        }
      }

      // Find crafting table if needed
      let craftingTable = null
      if (recipe.requiresTable) {
        console.log(`[ActionExecutor] Recipe requires crafting table`)

        craftingTable = this.bot.findBlock({
          matching: (b) => b && b.name === 'crafting_table',
          maxDistance: 32
        })

        if (!craftingTable) {
          this.lastError = 'Crafting table required but not found nearby. Need to place crafting table first.'
          console.log('[ActionExecutor] ❌ Crafting table required but not found nearby')
          console.log('[ActionExecutor] Need to place or find a crafting table first')
          return false
        }

        const distance = this.bot.entity.position.distanceTo(craftingTable.position)
        console.log(`[ActionExecutor] Found crafting table at distance ${distance.toFixed(1)}`)

        // Check if crafting table is too far
        if (distance > 4) {
          const pos = craftingTable.position
          this.lastError = `Crafting table is too far (${distance.toFixed(1)}m away). Move closer first to position (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}).`
          console.log(`[ActionExecutor] ❌ Crafting table is too far (${distance.toFixed(1)}m)`)
          console.log(`[ActionExecutor] Need to move closer to (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`)
          return false
        }
      }

      // Craft with timeout
      console.log(`[ActionExecutor] Starting craft...`)
      await Promise.race([
        this.bot.craft(recipe, count, craftingTable || undefined),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Crafting timeout')), 10000))
      ])

      console.log(`[ActionExecutor] ✅ Successfully crafted ${count}x ${itemName}`)
      return true

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.log(`[ActionExecutor] ❌ Crafting failed: ${errorMsg}`)

      if (errorMsg.includes('enough')) {
        console.log(`[ActionExecutor] Not enough materials in inventory`)
      }

      return false
    }
  }

  private async executeEquip(command: Command & { type: 'equip' }): Promise<boolean> {
    const { item, destination = 'hand' } = command

    const inventoryItem = this.bot.inventory.items().find(i => i.name === item)

    if (!inventoryItem) {
      console.log(`[ActionExecutor] ${item} not in inventory`)
      return false
    }


    try {
      await this.bot.equip(inventoryItem, destination)
      console.log(`[ActionExecutor] Equipped ${item}`)
      return true
    } catch (err) {
      return false
    }
  }

  private async executeEat(): Promise<boolean> {
    // Find food in inventory
    const food = this.bot.inventory.items().find(item => item.name.includes('beef') ||
      item.name.includes('porkchop') ||
      item.name.includes('chicken') ||
      item.name.includes('bread') ||
      item.name.includes('apple') ||
      item.name.includes('carrot') ||
      item.name.includes('potato'))

    if (!food) {
      console.log('[ActionExecutor] No food in inventory')
      return false
    }

    console.log(`[ActionExecutor] Eating ${food.name}`)

    try {
      await this.bot.equip(food, 'hand')
      // Consume with timeout
      await Promise.race([
        this.bot.consume(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Eating timeout')), 5000))
      ])
      console.log(`[ActionExecutor] Ate ${food.name}`)
      return true
    } catch (err) {
      console.log('[ActionExecutor] Eating failed:', err instanceof Error ? err.message : err)
      return false
    }
  }

  private executeChat(command: Command & { type: 'chat' }): boolean {
    const { message } = command

    // Minecraft chat has 256 character limit
    const truncatedMessage = message.length > 256 ? message.substring(0, 253) + '...' : message

    console.log(`[ActionExecutor] Chatting: ${truncatedMessage}`)
    this.bot.chat(truncatedMessage)

    return true
  }

  private async executeWait(command: Command & { type: 'wait' }): Promise<boolean> {
    const { duration = 1000 } = command

    console.log(`[ActionExecutor] Waiting ${duration}ms`)
    await new Promise(resolve => setTimeout(resolve, duration))

    return true
  }

  private executeFollow(command: Command & { type: 'follow' }): boolean {
    const { player } = command

    const targetPlayer = this.bot.players[player]?.entity

    if (!targetPlayer) {
      console.log(`[ActionExecutor] Player ${player} not found`)
      return false
    }

    console.log(`[ActionExecutor] Following ${player}`)

    this.followingPlayer = player
    const movements = new Movements(this.bot)
    this.bot.pathfinder.setMovements(movements)
    this.bot.pathfinder.setGoal(new GoalFollow(targetPlayer, 3), true)

    return true
  }

  private executeStopFollow(): boolean {
    console.log('[ActionExecutor] Stopped following')
    this.followingPlayer = null
    // Stop pathfinder completely
    this.bot.pathfinder.stop()
    this.bot.pathfinder.setGoal(null)
    return true
  }

  /**
   * Collect items dropped from mining
   */
  private async collectNearbyItems(dropPosition: Vec3, inventoryBefore: number, maxAttempts: number = 3): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait a bit for items to spawn
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check inventory first
      const inventoryAfter = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)
      if (inventoryAfter > inventoryBefore) {
        return true // Items collected!
      }

      // Look for nearby item entities
      const itemEntities = Object.values(this.bot.entities).filter(entity => {
        if (!entity || entity.type !== 'object') return false
        if (entity.kind !== 'Drops') return false

        // Check if item is near the drop position (within 5 blocks)
        const distance = entity.position.distanceTo(dropPosition)
        return distance < 5
      })

      if (itemEntities.length === 0) {
        continue // No items found, wait more
      }

      // Try to move to the nearest item
      const nearestItem = itemEntities.sort((a, b) =>
        this.bot.entity.position.distanceTo(a.position) -
        this.bot.entity.position.distanceTo(b.position)
      )[0]

      const distanceToItem = this.bot.entity.position.distanceTo(nearestItem.position)

      // If item is far, try to move to it
      if (distanceToItem > 2) {
        try {
          // Check if there's a direct path
          const movements = new Movements(this.bot)
          this.bot.pathfinder.setMovements(movements)

          const itemPos = nearestItem.position
          await Promise.race([
            this.bot.pathfinder.goto(new GoalNear(itemPos.x, itemPos.y, itemPos.z, 1)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Item collection timeout')), 3000))
          ])
        } catch (err) {
          // Pathfinding failed - maybe blocked
          // Try to clear a path by breaking blocks
          const success = await this.clearPathToItem(nearestItem.position)
          if (!success) {
            continue // Can't reach item, try next attempt
          }
        }
      }

      // Wait a bit more for auto-collection
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check inventory again
      const finalInventory = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)
      if (finalInventory > inventoryBefore) {
        return true
      }
    }

    // Failed to collect after all attempts
    return false
  }

  /**
   * Clear path to item by breaking blocking blocks
   */
  private async clearPathToItem(itemPosition: Vec3): Promise<boolean> {
    const botPos = this.bot.entity.position

    // Find blocks between bot and item
    const direction = itemPosition.minus(botPos).normalize()

    // Check block 1 block in front of bot in direction of item
    const checkPos = botPos.offset(
      Math.round(direction.x),
      0,
      Math.round(direction.z)
    )

    const blockingBlock = this.bot.blockAt(checkPos)

    if (!blockingBlock || blockingBlock.name === 'air') {
      return false // No blocking block
    }

    // Try to break the blocking block (if it's breakable)
    if (blockingBlock.name === 'stone' ||
        blockingBlock.name === 'dirt' ||
        blockingBlock.name === 'grass_block' ||
        blockingBlock.name.includes('log') ||
        blockingBlock.name.includes('leaves')) {

      try {
        // Check if we can dig it
        if (!this.bot.canDigBlock(blockingBlock)) {
          return false
        }

        await Promise.race([
          this.bot.dig(blockingBlock),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Clearing timeout')), 3000))
        ])

        return true
      } catch (err) {
        return false
      }
    }

    return false
  }

  /**
   * Auto-craft and equip appropriate tool for mining
   */
  private async ensureProperTool(blockType: string): Promise<boolean> {

    // Get required tool materials for this block
    const requiredMaterials = this.MINING_REQUIREMENTS[blockType]

    if (!requiredMaterials) {
      // No special tool required
      return true
    }

    // Check if we already have an appropriate pickaxe equipped
    const handItem = this.bot.inventory.slots[this.bot.getEquipmentDestSlot('hand')]
    if (handItem && handItem.name.includes('pickaxe')) {
      const material = this.TOOL_MATERIALS.find(m => handItem.name.includes(m))
      if (material && requiredMaterials.includes(material)) {
        return true
      }
    }

    // Find best available pickaxe in inventory
    for (const material of this.TOOL_MATERIALS) {
      if (!requiredMaterials.includes(material)) continue

      const pickaxe = this.bot.inventory.items().find(item =>
        item.name === `${material}_pickaxe`
      )

      if (pickaxe) {
        await this.bot.equip(pickaxe, 'hand')
        return true
      }
    }

    // No pickaxe found, try to craft one
    return await this.autoCraftPickaxe(requiredMaterials)
  }

  /**
   * Auto-craft the best possible pickaxe
   */
  private async autoCraftPickaxe(requiredMaterials: string[]): Promise<boolean> {
    const mcData = require('minecraft-data')(this.bot.version)

    // Try to craft the best pickaxe we can
    for (const material of this.TOOL_MATERIALS) {
      if (!requiredMaterials.includes(material)) continue

      const pickaxeName = `${material}_pickaxe`
      const pickaxeId = mcData.itemsByName[pickaxeName]?.id

      if (!pickaxeId) continue

      // Check if we have a recipe
      const recipes = this.bot.recipesFor(pickaxeId, null, 1, null)
      if (!recipes || recipes.length === 0) continue

      const recipe = recipes[0]

      // Check if we can craft (have materials)
      try {
        // Check for crafting table if needed
        if (recipe.requiresTable) {
          const hasTable = this.bot.inventory.items().some(item => item.name === 'crafting_table')
          const nearbyTable = this.bot.findBlock({
            matching: (b) => b && b.name === 'crafting_table',
            maxDistance: 32
          })

          if (!hasTable && !nearbyTable) {
            // Try to craft a crafting table first
            const tableId = mcData.itemsByName['crafting_table']?.id
            if (tableId) {
              const tableRecipes = this.bot.recipesFor(tableId, null, 1, null)
              if (tableRecipes && tableRecipes.length > 0) {
                await this.bot.craft(tableRecipes[0], 1)
              }
            }
          }
        }

        await this.bot.craft(recipe, 1)

        // Equip the newly crafted pickaxe
        const newPickaxe = this.bot.inventory.items().find(item => item.name === pickaxeName)
        if (newPickaxe) {
          await this.bot.equip(newPickaxe, 'hand')
          return true
        }
      } catch (err) {
        // Continue to next material
      }
    }

    return false
  }

  private async executeToss(command: Command & { type: 'toss' }): Promise<boolean> {
    const { item, count, player } = command

    // Find item in inventory
    const inventoryItem = this.bot.inventory.items().find(i => i.name === item)

    if (!inventoryItem) {
      console.log(`[ActionExecutor] ${item} not in inventory`)
      return false
    }

    const tossCount = count && count <= inventoryItem.count ? count : inventoryItem.count

    console.log(`[ActionExecutor] Tossing ${tossCount}x ${item}${player ? ` to ${player}` : ''}`)

    try {
      // If target player specified, look at them first
      if (player) {
        const targetPlayer = this.bot.players[player]?.entity
        if (targetPlayer) {
          await this.bot.lookAt(targetPlayer.position.offset(0, targetPlayer.height, 0))
        } else {
          console.log(`[ActionExecutor] Player ${player} not found, dropping item instead`)
        }
      }

      // Toss the item
      await this.bot.toss(inventoryItem.type, null, tossCount)
      console.log(`[ActionExecutor] Tossed ${tossCount}x ${item}`)
      return true
    } catch (err) {
      console.log('[ActionExecutor] Tossing failed:', err)
      return false
    }
  }

  /**
   * Check if currently following someone
   */
  public isFollowing(): boolean {
    return this.followingPlayer !== null
  }

  /**
   * Get currently following player
   */
  public getFollowingPlayer(): string | null {
    return this.followingPlayer
  }
}
