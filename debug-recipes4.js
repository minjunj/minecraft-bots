// Check recipes by item ID
const mcData = require('minecraft-data')('1.21.9')

console.log('=== Checking Recipes by Item ID ===\n')

const itemsToCheck = [
  { name: 'birch_planks', id: 38 },
  { name: 'stick', id: 946 },
  { name: 'wooden_pickaxe', id: 913 }
]

for (const item of itemsToCheck) {
  console.log(`\n${item.name} (ID: ${item.id}):`)

  if (mcData.recipes && mcData.recipes[item.id]) {
    const recipes = mcData.recipes[item.id]
    console.log(`✓ Found ${recipes.length} recipe(s)`)
    console.log(JSON.stringify(recipes[0], null, 2))
  } else {
    console.log(`✗ No recipe found`)
  }
}

// Also check oak_planks
const oakPlanks = mcData.itemsByName['oak_planks']
console.log(`\n\noak_planks (ID: ${oakPlanks.id}):`)
if (mcData.recipes && mcData.recipes[oakPlanks.id]) {
  const recipes = mcData.recipes[oakPlanks.id]
  console.log(`✓ Found ${recipes.length} recipe(s)`)
  console.log(JSON.stringify(recipes[0], null, 2))
}

// List all recipe IDs
console.log(`\n\n=== All available recipe IDs (first 20) ===`)
if (mcData.recipes) {
  const recipeIds = Object.keys(mcData.recipes).map(Number).sort((a, b) => a - b)
  console.log(recipeIds.slice(0, 20).join(', '))
}
