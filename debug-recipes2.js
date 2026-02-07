// Check recipes directly from minecraft-data
const mcData = require('minecraft-data')('1.21.9')

console.log('=== Recipe Check for Minecraft 1.21.9 ===\n')

// Check birch_planks recipe
const birchPlanks = mcData.itemsByName['birch_planks']
console.log(`birch_planks item ID: ${birchPlanks.id}`)

// Look for recipes
if (mcData.recipes) {
  const birchPlanksRecipes = Object.values(mcData.recipes).filter(r => r.result?.id === birchPlanks.id)
  console.log(`Found ${birchPlanksRecipes.length} recipes for birch_planks`)

  if (birchPlanksRecipes.length > 0) {
    console.log('Recipe details:', JSON.stringify(birchPlanksRecipes[0], null, 2))
  }
} else {
  console.log('No recipes data available in minecraft-data')
}

console.log()

// Check stick recipe
const stick = mcData.itemsByName['stick']
console.log(`stick item ID: ${stick.id}`)

if (mcData.recipes) {
  const stickRecipes = Object.values(mcData.recipes).filter(r => r.result?.id === stick.id)
  console.log(`Found ${stickRecipes.length} recipes for stick`)

  if (stickRecipes.length > 0) {
    console.log('Recipe details:', JSON.stringify(stickRecipes[0], null, 2))
  }
}

console.log()

// Check wooden_pickaxe recipe
const woodenPickaxe = mcData.itemsByName['wooden_pickaxe']
console.log(`wooden_pickaxe item ID: ${woodenPickaxe.id}`)

if (mcData.recipes) {
  const pickaxeRecipes = Object.values(mcData.recipes).filter(r => r.result?.id === woodenPickaxe.id)
  console.log(`Found ${pickaxeRecipes.length} recipes for wooden_pickaxe`)

  if (pickaxeRecipes.length > 0) {
    console.log('Recipe details:', JSON.stringify(pickaxeRecipes[0], null, 2))
  }
}

console.log('\n=== Total recipes in minecraft-data ===')
if (mcData.recipes) {
  console.log(`Total recipes available: ${Object.keys(mcData.recipes).length}`)
} else {
  console.log('No recipes available')
}
