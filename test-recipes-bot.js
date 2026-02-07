// Test recipesFor with actual bot connection
require('dotenv').config()
const mineflayer = require('mineflayer')

const bot = mineflayer.createBot({
  host: process.env.MINECRAFT_HOST || '20.243.34.235',
  port: parseInt(process.env.MINECRAFT_PORT || '25565'),
  username: 'RecipeTestBot',
  version: '1.21.9',
  auth: 'offline'
})

bot.once('spawn', () => {
  console.log('Bot spawned, testing recipes...\n')

  const mcData = require('minecraft-data')(bot.version)

  // Test wooden_pickaxe by ID
  console.log('=== Test 1: wooden_pickaxe by ID ===')
  const woodenPickaxe = mcData.items[913]
  console.log(`Item 913: ${woodenPickaxe ? woodenPickaxe.name : 'NOT FOUND'}`)

  if (woodenPickaxe) {
    console.log(`Trying bot.recipesFor(${woodenPickaxe.id}, null, 1, null)...`)
    const recipes = bot.recipesFor(woodenPickaxe.id, null, 1, null)
    console.log(`Recipes found: ${recipes ? recipes.length : 0}`)

    if (recipes && recipes.length > 0) {
      console.log('First recipe:', JSON.stringify(recipes[0], null, 2))
    }
  }

  // Test by name
  console.log('\n=== Test 2: wooden_pickaxe by name ===')
  const item = mcData.itemsByName['wooden_pickaxe']
  console.log(`wooden_pickaxe: ID ${item ? item.id : 'NOT FOUND'}`)

  if (item) {
    const recipes = bot.recipesFor(item.id, null, 1, null)
    console.log(`Recipes found: ${recipes ? recipes.length : 0}`)
  }

  // List all available recipes
  console.log('\n=== Test 3: Check if bot has recipe data ===')
  console.log(`bot.recipesFor exists: ${typeof bot.recipesFor}`)

  // Try oak_planks (simpler recipe)
  console.log('\n=== Test 4: oak_planks (simpler recipe) ===')
  const oakPlanks = mcData.itemsByName['oak_planks']
  console.log(`oak_planks: ID ${oakPlanks.id}`)
  const planksRecipes = bot.recipesFor(oakPlanks.id, null, 1, null)
  console.log(`Recipes found: ${planksRecipes ? planksRecipes.length : 0}`)

  if (planksRecipes && planksRecipes.length > 0) {
    console.log('First recipe:', JSON.stringify(planksRecipes[0], null, 2))
  }

  console.log('\n=== Disconnecting ===')
  bot.quit()
  process.exit(0)
})

bot.on('error', (err) => {
  console.error('Error:', err)
  process.exit(1)
})

setTimeout(() => {
  console.log('Timeout - taking too long')
  process.exit(1)
}, 30000)
