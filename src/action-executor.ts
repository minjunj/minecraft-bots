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
    'iron_ore': ['stone', 'iron', 'diamond'],
    'gold_ore': ['iron', 'diamond'],
    'diamond_ore': ['iron', 'diamond'],
    'obsidian': ['diamond']
  }

  constructor(bot: Bot) {
    this.bot = bot
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
    console.log(`[ActionExecutor] Executing: ${command.type}`)

    try {
      switch (command.type) {
        case 'move':
          return await this.executeMove(command)

        case 'look':
          return await this.executeLook(command)

        case 'attack':
          return await this.executeAttack(command)

        case 'mine':
          return await this.executeMine(command)

        case 'place':
          return await this.executePlace(command)

        case 'craft':
          return await this.executeCraft(command)

        case 'equip':
          return await this.executeEquip(command)

        case 'eat':
          return await this.executeEat()

        case 'chat':
          return this.executeChat(command)

        case 'wait':
          return await this.executeWait(command)

        case 'follow':
          return this.executeFollow(command)

        case 'stop_follow':
          return this.executeStopFollow()

        case 'toss':
          return await this.executeToss(command)

        default:
          console.log(`[ActionExecutor] Unknown command type`)
          return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[ActionExecutor] Error executing ${command.type}:`, errorMsg)
      return false
    }
  }

  private async executeMove(command: Command & { type: 'move' }): Promise<boolean> {
    const { x, y, z } = command
    console.log(`[ActionExecutor] Moving to (${x}, ${y}, ${z})`)

    this.followingPlayer = null
    const movements = new Movements(this.bot)
    this.bot.pathfinder.setMovements(movements)

    try {
      await Promise.race([
        this.bot.pathfinder.goto(new GoalNear(x, y, z, 1)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Movement timeout')), 15000)
        )
      ])
      console.log('[ActionExecutor] Arrived at destination')
      return true
    } catch (err) {
      console.log('[ActionExecutor] Could not reach destination')
      return false
    }
  }

  private async executeLook(command: Command & { type: 'look' }): Promise<boolean> {
    const { target, name, x, y, z } = command

    if (target === 'position' && x !== undefined && y !== undefined && z !== undefined) {
      const pos = new Vec3(x, y, z)
      await this.bot.lookAt(pos)
      console.log(`[ActionExecutor] Looking at position (${x}, ${y}, ${z})`)
      return true
    }

    if (target === 'player' && name) {
      const player = this.bot.players[name]?.entity
      if (player) {
        await this.bot.lookAt(player.position.offset(0, player.height, 0))
        console.log(`[ActionExecutor] Looking at player ${name}`)
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
        console.log(`[ActionExecutor] Looking at entity ${name}`)
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

    console.log(`[ActionExecutor] Attacking ${entity.name || 'entity'}`)

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

    console.log('[ActionExecutor] Invalid mine command')
    return false
  }

  private async mineAtPosition(x: number, y: number, z: number): Promise<boolean> {
    const pos = new Vec3(x, y, z)
    const block = this.bot.blockAt(pos)

    if (!block || block.name === 'air') {
      console.log(`[ActionExecutor] No block at (${x}, ${y}, ${z})`)
      return false
    }

    console.log(`[ActionExecutor] Mining ${block.name} at (${x}, ${y}, ${z})`)

    try {
      // Ensure we have the proper tool
      await this.ensureProperTool(block.name)

      // Move close if needed
      const distance = this.bot.entity.position.distanceTo(pos)
      if (distance > 4) {
        const movements = new Movements(this.bot)
        this.bot.pathfinder.setMovements(movements)
        await Promise.race([
          this.bot.pathfinder.goto(new GoalNear(x, y, z, 3)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pathfinding timeout')), 10000))
        ])
      }

      // Verify block still exists
      const blockToMine = this.bot.blockAt(pos)
      if (!blockToMine || blockToMine.name === 'air') {
        console.log(`[ActionExecutor] Block no longer exists`)
        return false
      }

      // Get inventory count before mining
      const inventoryBefore = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)

      // Mine block with timeout
      await Promise.race([
        this.bot.dig(blockToMine),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mining timeout')), 15000))
      ])

      // Wait a moment for items to be picked up
      await new Promise(resolve => setTimeout(resolve, 300))

      // Get inventory count after mining
      const inventoryAfter = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)

      // Check if we actually obtained items
      if (inventoryAfter <= inventoryBefore) {
        console.log(`[ActionExecutor] ⚠️  Mined ${blockToMine.name} but got NO items - wrong tool tier?`)
        this.lastError = `Mining ${blockToMine.name} completed but no items obtained. You probably need a better tool tier! Check TOOL REQUIREMENTS section.`
        return false
      }

      console.log(`[ActionExecutor] Mined ${blockToMine.name} - items obtained: +${inventoryAfter - inventoryBefore}`)
      return true
    } catch (err) {
      console.log('[ActionExecutor] Mining failed:', err)
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

    console.log(`[ActionExecutor] Mining ${targetCount}x ${blockType}`)

    // Ensure we have proper tool before starting
    await this.ensureProperTool(blockType)

    let minedCount = 0

    for (let i = 0; i < targetCount; i++) {
      try {
        // Find nearest block of this type
        const block = this.bot.findBlock({
          matching: (b) => b && b.name === blockType,
          maxDistance: 32
        })

        if (!block) {
          console.log(`[ActionExecutor] No ${blockType} found nearby (mined ${minedCount}/${targetCount})`)
          return minedCount > 0
        }

        // Move to block
        const distance = this.bot.entity.position.distanceTo(block.position)
        if (distance > 4) {
          const movements = new Movements(this.bot)
          this.bot.pathfinder.setMovements(movements)
          await Promise.race([
            this.bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 3)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pathfinding timeout')), 10000))
          ])
        }

        // Verify block still exists
        const blockToMine = this.bot.blockAt(block.position)
        if (!blockToMine || blockToMine.name === 'air') {
          console.log(`[ActionExecutor] Block disappeared, skipping`)
          continue
        }

        // Get inventory count before mining
        const inventoryBefore = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)

        // Mine block with timeout
        await Promise.race([
          this.bot.dig(blockToMine),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mining timeout')), 15000))
        ])

        // Wait a moment for items to be picked up
        await new Promise(resolve => setTimeout(resolve, 300))

        // Get inventory count after mining
        const inventoryAfter = this.bot.inventory.items().reduce((sum, item) => sum + item.count, 0)

        // Check if we actually obtained items
        if (inventoryAfter <= inventoryBefore) {
          console.log(`[ActionExecutor] ⚠️  Mined ${blockType} but got NO items - wrong tool tier?`)
          this.lastError = `Mining ${blockType} completed but no items obtained. You probably need a better tool tier! Check TOOL REQUIREMENTS section.`
          return false
        }

        minedCount++
        console.log(`[ActionExecutor] Mined ${blockType} (${minedCount}/${targetCount}) - items obtained: +${inventoryAfter - inventoryBefore}`)

      } catch (err) {
        console.log(`[ActionExecutor] Failed to mine ${blockType}:`, err)
        // Continue to next block
      }
    }

    console.log(`[ActionExecutor] Finished mining ${blockType}: ${minedCount}/${targetCount}`)
    return minedCount > 0
  }

  private async executePlace(command: Command & { type: 'place' }): Promise<boolean> {
    const { block, x, y, z } = command

    // Check if this block type already exists nearby
    const existingBlock = this.bot.findBlock({
      matching: (b) => b && b.name === block,
      maxDistance: 32
    })

    if (existingBlock && block === 'crafting_table') {
      const distance = this.bot.entity.position.distanceTo(existingBlock.position)
      this.lastError = `${block} already exists nearby (${distance.toFixed(1)}m away). Don't place another one - use the existing one!`
      console.log(`[ActionExecutor] ❌ ${block} already exists at ${distance.toFixed(1)}m away`)
      console.log(`[ActionExecutor] No need to place another one`)
      return false
    }

    // Find block in inventory
    const item = this.bot.inventory.items().find(i => i.name === block)

    if (!item) {
      this.lastError = `${block} not in inventory. Cannot place it.`
      console.log(`[ActionExecutor] ❌ ${block} not in inventory`)
      return false
    }

    const pos = new Vec3(x, y, z)
    const targetBlock = this.bot.blockAt(pos)

    if (!targetBlock) {
      this.lastError = `Cannot place at (${x}, ${y}, ${z}). Position is out of world or too far away.`
      console.log(`[ActionExecutor] ❌ Cannot place at (${x}, ${y}, ${z})`)
      return false
    }

    console.log(`[ActionExecutor] Placing ${block} at (${x}, ${y}, ${z})`)

    try {
      // Equip block
      await this.bot.equip(item, 'hand')

      // Place block
      await this.bot.placeBlock(targetBlock, new Vec3(0, 1, 0))

      console.log(`[ActionExecutor] ✅ Placed ${block}`)
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.lastError = `Cannot place ${block} at (${x}, ${y}, ${z}). ${errorMsg}. Try different coordinates or check if space is occupied.`
      console.log(`[ActionExecutor] ❌ Placing failed: ${errorMsg}`)
      return false
    }
  }

  private async executeCraft(command: Command & { type: 'craft' }): Promise<boolean> {
    let { item, count = 1 } = command

    console.log(`[ActionExecutor] Crafting ${count}x ${item}`)

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

    console.log(`[ActionExecutor] Equipping ${item} to ${destination}`)

    try {
      await this.bot.equip(inventoryItem, destination)
      console.log(`[ActionExecutor] Equipped ${item}`)
      return true
    } catch (err) {
      console.log('[ActionExecutor] Equipping failed')
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
   * Auto-craft and equip appropriate tool for mining
   */
  private async ensureProperTool(blockType: string): Promise<boolean> {
    console.log(`[ActionExecutor] Checking tool for ${blockType}`)

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
        console.log(`[ActionExecutor] Already have ${handItem.name} equipped`)
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
        console.log(`[ActionExecutor] Equipping ${pickaxe.name}`)
        await this.bot.equip(pickaxe, 'hand')
        return true
      }
    }

    // No pickaxe found, try to craft one
    console.log(`[ActionExecutor] No suitable pickaxe found, attempting to craft`)
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
                console.log(`[ActionExecutor] Crafting crafting_table`)
                await this.bot.craft(tableRecipes[0], 1)
              }
            }
          }
        }

        console.log(`[ActionExecutor] Crafting ${pickaxeName}`)
        await this.bot.craft(recipe, 1)

        // Equip the newly crafted pickaxe
        const newPickaxe = this.bot.inventory.items().find(item => item.name === pickaxeName)
        if (newPickaxe) {
          await this.bot.equip(newPickaxe, 'hand')
          console.log(`[ActionExecutor] Successfully crafted and equipped ${pickaxeName}`)
          return true
        }
      } catch (err) {
        console.log(`[ActionExecutor] Cannot craft ${pickaxeName}:`, err instanceof Error ? err.message : err)
        // Continue to next material
      }
    }

    console.log(`[ActionExecutor] Unable to craft any suitable pickaxe`)
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
          console.log(`[ActionExecutor] Looking at ${player}`)
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
