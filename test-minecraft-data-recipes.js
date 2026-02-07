// Test minecraft-data recipes directly
const mcData = require('minecraft-data')('1.21.9')

console.log('=== Minecraft Data Recipes Test ===\n')

console.log(`Total recipes: ${mcData.recipes ? Object.keys(mcData.recipes).length : 0}`)

if (mcData.recipes) {
  // Test wooden_pickaxe
  const woodenPickaxe = mcData.itemsByName['wooden_pickaxe']
  console.log(`\nwooden_pickaxe ID: ${woodenPickaxe.id}`)

  if (mcData.recipes[woodenPickaxe.id]) {
    console.log(`\nRecipes for wooden_pickaxe (ID ${woodenPickaxe.id}):`)
    const recipes = mcData.recipes[woodenPickaxe.id]
    console.log(JSON.stringify(recipes, null, 2))
  } else {
    console.log(`No recipe for ID ${woodenPickaxe.id}`)
  }

  // Test oak_planks
  const oakPlanks = mcData.itemsByName['oak_planks']
  console.log(`\n\noak_planks ID: ${oakPlanks.id}`)

  if (mcData.recipes[oakPlanks.id]) {
    console.log(`\nRecipes for oak_planks (ID ${oakPlanks.id}):`)
    const recipes = mcData.recipes[oakPlanks.id]
    console.log(JSON.stringify(recipes, null, 2))
  }

  // Sample some recipe IDs
  console.log('\n=== Sample recipe IDs ===')
  const recipeIds = Object.keys(mcData.recipes).slice(0, 10).map(Number)
  console.log(recipeIds.join(', '))

  for (const id of recipeIds.slice(0, 3)) {
    const item = mcData.items[id]
    console.log(`\nID ${id}: ${item ? item.name : 'unknown'}`)
    console.log(JSON.stringify(mcData.recipes[id][0], null, 2))
  }
}
