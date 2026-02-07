const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalBlock, GoalNear } = goals

const bot = mineflayer.createBot({
  host: '0.0.0.0',
  port: 25565,
  username: 'MyBot2',
  version: '1.21.9',
  auth: 'offline'
})

// Load pathfinder plugin for movement
bot.loadPlugin(pathfinder)

let isMining = false
const failedBlocks = new Set()

// Clear failed blocks every 30 seconds to retry them later
setInterval(() => {
  failedBlocks.clear()
}, 30000)

// Auto-mining function
async function autoMine() {
  if (isMining) return
  isMining = true

  try {
    // Find nearest valuable block (stone, coal, iron, etc.)
    const blockToMine = bot.findBlock({
      matching: (block) => {
        if (!block || !block.position) return false

        const blockKey = `${block.position.x},${block.position.y},${block.position.z}`
        if (failedBlocks.has(blockKey)) return false

        return block.name === 'stone' ||
               block.name === 'coal_ore' ||
               block.name === 'iron_ore' ||
               block.name === 'dirt' ||
               block.name === 'oak_log'
      },
      maxDistance: 32
    })

    if (blockToMine) {
      const blockKey = `${blockToMine.position.x},${blockToMine.position.y},${blockToMine.position.z}`
      console.log(`Found ${blockToMine.name} at ${blockToMine.position}`)

      // Move to the block with timeout
      const defaultMove = new Movements(bot)
      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new GoalNear(blockToMine.position.x, blockToMine.position.y, blockToMine.position.z, 1))

      // Wait for pathfinding with timeout
      await Promise.race([
        bot.pathfinder.goto(new GoalNear(blockToMine.position.x, blockToMine.position.y, blockToMine.position.z, 1)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Pathfinding timeout')), 5000))
      ])

      // Mine the block if we're close enough
      if (bot.entity.position.distanceTo(blockToMine.position) <= 5) {
        console.log(`Mining ${blockToMine.name}...`)
        await bot.dig(blockToMine)
        console.log(`Successfully mined ${blockToMine.name}!`)
      } else {
        console.log(`Too far from block, marking as failed`)
        failedBlocks.add(blockKey)
      }

      // Wait a bit before next mining
      setTimeout(autoMine, 500)
    } else {
      console.log('No blocks found nearby, exploring...')
      // Move randomly to explore
      if (bot.entity && bot.entity.position) {
        const x = bot.entity.position.x + (Math.random() - 0.5) * 30
        const z = bot.entity.position.z + (Math.random() - 0.5) * 30
        const y = bot.entity.position.y

        const defaultMove = new Movements(bot)
        bot.pathfinder.setMovements(defaultMove)

        try {
          await Promise.race([
            bot.pathfinder.goto(new GoalNear(Math.floor(x), Math.floor(y), Math.floor(z), 2)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Exploration timeout')), 5000))
          ])
        } catch (exploreErr) {
          console.log('Exploration failed, trying different direction...')
        }
      }

      setTimeout(autoMine, 1000)
    }
  } catch (err) {
    console.log('Error during mining:', err.message)

    // Try to explore when stuck
    if (bot.entity && bot.entity.position) {
      try {
        const x = bot.entity.position.x + (Math.random() - 0.5) * 20
        const z = bot.entity.position.z + (Math.random() - 0.5) * 20
        bot.pathfinder.setGoal(new GoalNear(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z), 2))
      } catch (moveErr) {
        console.log('Failed to set new goal')
      }
    }

    setTimeout(autoMine, 2000)
  } finally {
    isMining = false
  }
}

bot.on('spawn', () => {
  console.log('Spawned — I am ready!')
  console.log('Starting auto-mining bot...')

  // Start auto-mining after 2 seconds
  setTimeout(() => {
    autoMine()
  }, 2000)
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return
  if (message === 'hi') bot.chat(`Hello ${username}!`)
  if (message === 'stop') {
    isMining = false
    bot.chat('Stopping auto-mine...')
  }
  if (message === 'start') {
    bot.chat('Starting auto-mine...')
    autoMine()
  }
  if (message === 'pos') {
    const pos = bot.entity.position
    bot.chat(`I am at ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`)
  }
})

bot.on('error', (err) => {
  console.log('Bot error:', err)
})

bot.on('kicked', (reason) => {
  console.log('Bot was kicked:', reason)
})
