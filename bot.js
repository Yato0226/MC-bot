require('dotenv').config()
const mineflayer = require('mineflayer')
const baritone = require('@miner-org/mineflayer-baritone').loader
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow;
const readline = require('readline')

let currentHuntInterval = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const bot = mineflayer.createBot({
  host: process.env.MC_HOST, // Minecraft server host
  port: 25565,       // Minecraft server port
  username: 'Bloop',   // Bot's username
  version: '1.21.8'  // Minecraft version
})

const mcData = require('minecraft-data')(bot.version); // Import minecraft-data after bot creation

bot.loadPlugin(baritone)
bot.loadPlugin(pathfinder) // Load the pathfinder plugin

bot.on('spawn', () => {
  console.log('Bot spawned!')
//  bot.chat('Hello!') // The bot says "hellohello" when it spawns

  rl.on('line', (line) => {
    bot.chat(line)
  })

  rl.on('close', () => {
    bot.end()
  })
})


bot.on('chat', (username, message) => {
  if (username !== 'Luize26') return // Only listen to Luize26
  console.log(`${username}: ${message}`)

  if (message === 'hi bot') {
    bot.chat('hello there!')
  } else if (message.startsWith('follow ')) {
    const targetName = message.substring('follow '.length)
    const target = bot.players[targetName] ? bot.players[targetName].entity : bot.entities.find(e => e.name === targetName)

    if (!target || !target.entity) {
        bot.chat(`I can't see ${targetName}.`);
        return;
    }

    bot.chat(`Following ${targetName}`);

    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    const followGoal = new GoalFollow(target.entity, 3);
    bot.pathfinder.setGoal(followGoal, true);
  } else if (message.startsWith('hunt ')) {
    const targetName = message.substring('hunt '.length)
    const target = bot.entities.find(e => e.name === targetName && e.type === 'mob')

    if (target) {
      bot.chat(`Hunting ${targetName}`)
      // Replaced bot.baritone.follow with bot.ashfinder.goto as 'follow' is not in the provided API reference.
      // Note: 'goto' navigates to a static goal. For continuous following of a moving target,
      // a more complex logic involving repeated calls to 'goto' with updated target positions might be needed.
      bot.ashfinder.goto(target.position)

      const attackInterval = setInterval(() => {
        const distance = bot.entity.position.distanceTo(target.position)
        if (distance < 3) { // Attack when close enough
          bot.attack(target)
        }
        if (target.isValid === false) { // Stop hunting if target is dead
          clearInterval(attackInterval)
          bot.chat(`Finished hunting ${targetName}`)
          bot.ashfinder.stop()
        }
      }, 1000) // Check every second
    } else {
      bot.chat(`Could not find mob ${targetName}`)
    }
  } else if (message === 'chop') {
    const treeBlock = bot.findBlock({
      matching: (block) => block.name.includes('log'),
      maxDistance: 64
    })

    if (treeBlock) {
      bot.chat('Chopping nearest tree...')
      bot.ashfinder.goto(treeBlock.position, () => {
        bot.dig(treeBlock, () => {
          bot.chat('Finished chopping tree.')
        })
      })
    } else {
      bot.chat('No trees found nearby.')
    }
  } else if (message === 'stop') {
    bot.chat('Stopping current action.')
    bot.ashfinder.stop()
  }
})

bot.on('error', err => console.log(err))
bot.on('end', () => console.log('Disconnected'))
