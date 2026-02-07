// Test recipesAll to see if recipes exist at all
require('dotenv').config()
const mineflayer = require('mineflayer')

const bot = mineflayer.createBot({
  host: process.env.MINECRAFT_HOST || '20.243.34.235',
  port: parseInt(process.env.MINECRAFT_PORT || '25565'),
  username: 'RecipeTestBot2',
  version: '1.21.9',
  auth: 'offline'
})

bot.once('spawn', () => {
  console.log('Bot spawned, checking recipes...\n')

  // Wait a bit for recipes to load
  setTimeout(() => {
    console.log('=== Checking recipe functions ===')
    console.log(`bot.recipesFor: ${typeof bot.recipesFor}`)
    console.log(`bot.recipesAll: ${typeof bot.recipesAll}`)

    if (typeof bot.recipesAll === 'function') {
      const allRecipes = bot.recipesAll()
      console.log(`\nTotal recipes available: ${allRecipes ? allRecipes.length : 0}`)

      if (allRecipes && allRecipes.length > 0) {
        // Find wooden_pickaxe recipe
        const woodenPickaxeRecipes = allRecipes.filter(r => r.result && r.result.id === 913)
        console.log(`\nwooden_pickaxe recipes found: ${woodenPickaxeRecipes.length}`)

        if (woodenPickaxeRecipes.length > 0) {
          console.log('\nFirst wooden_pickaxe recipe:')
          console.log(JSON.stringify(woodenPickaxeRecipes[0], null, 2))
        }

        // Show first few recipes as sample
        console.log('\n=== Sample recipes (first 3) ===')
        for (let i = 0; i < Math.min(3, allRecipes.length); i++) {
          const r = allRecipes[i]
          console.log(`Recipe ${i}: result ID ${r.result?.id}, requiresTable: ${r.requiresTable}`)
        }
      }
    } else {
      console.log('recipesAll not available')
    }

    bot.quit()
    process.exit(0)
  }, 3000) // Wait 3 seconds for data to load
})

bot.on('error', (err) => {
  console.error('Error:', err)
  process.exit(1)
})

setTimeout(() => {
  console.log('Timeout')
  process.exit(1)
}, 40000)
