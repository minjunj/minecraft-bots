// Debug script to check what items and recipes are available
const mineflayer = require('mineflayer')
const mcData = require('minecraft-data')('1.21.9')

console.log('=== Checking Minecraft 1.21.9 Data ===\n')

// Check for planks
console.log('Looking for plank items:')
const plankNames = Object.keys(mcData.itemsByName).filter(name => name.includes('plank'))
console.log(plankNames.join(', '))
console.log()

// Check for stick
console.log('Looking for stick:')
const stickNames = Object.keys(mcData.itemsByName).filter(name => name.includes('stick'))
console.log(stickNames.join(', '))
console.log()

// Check for pickaxe
console.log('Looking for pickaxe:')
const pickaxeNames = Object.keys(mcData.itemsByName).filter(name => name.includes('pickaxe'))
console.log(pickaxeNames.join(', '))
console.log()

// Check for logs
console.log('Looking for log items:')
const logNames = Object.keys(mcData.itemsByName).filter(name => name.includes('log'))
console.log(logNames.join(', '))
console.log()

// Try to check recipes
console.log('=== Recipe Check ===')
const items = ['oak_planks', 'birch_planks', 'planks', 'stick', 'sticks', 'wooden_pickaxe']
for (const itemName of items) {
  const item = mcData.itemsByName[itemName]
  if (item) {
    console.log(`✓ Found: ${itemName} (id: ${item.id})`)
  } else {
    console.log(`✗ Not found: ${itemName}`)
  }
}
