// Check recipe structure
const mcData = require('minecraft-data')('1.21.9')

console.log('=== Recipe Structure Check ===\n')

if (mcData.recipes) {
  // Get first few recipes to see structure
  const recipeKeys = Object.keys(mcData.recipes).slice(0, 5)

  console.log('Sample recipes:')
  for (const key of recipeKeys) {
    const recipe = mcData.recipes[key]
    console.log(`\nRecipe key: ${key}`)
    console.log(JSON.stringify(recipe, null, 2))
  }

  // Look for planks in recipe keys
  console.log('\n\n=== Searching for plank recipes ===')
  const plankRecipes = Object.keys(mcData.recipes).filter(key => key.includes('plank'))
  console.log(`Found ${plankRecipes.length} plank-related recipe keys:`)
  console.log(plankRecipes.slice(0, 10).join('\n'))

  if (plankRecipes.length > 0) {
    console.log('\nFirst plank recipe details:')
    console.log(JSON.stringify(mcData.recipes[plankRecipes[0]], null, 2))
  }
} else {
  console.log('No recipes data')
}
