require('dotenv').config()
const mineflayer = require('mineflayer')
const baritone = require('@miner-org/mineflayer-baritone').loader
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow;
const mineflayerViewer = require('prismarine-viewer').mineflayer
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

const mcData = require('minecraft-data')(bot.version); 

bot.loadPlugin(baritone)
bot.loadPlugin(pathfinder) 

bot.on('spawn', () => {
  console.log('Bot spawned!')
  mineflayerViewer(bot, { port: 3007, firstPerson: false }) // Initialize the viewer
//  bot.chat('Hello!') // The bot says "hellohello" when it spawns

        rl.on('line', (line) => {
          bot.chat(`${line}`)
        })
  rl.on('close', () => {
    bot.end()
  })
})


bot.on('chat', (username, message) => {
  //if (username !== 'Luize26') return // Only listen to Luize26
  if (username === bot.username) return // Ignore messages from itself // this will respond to everyone
  console.log(`${username}: ${message}`)

  if (message === 'hi bot') {
    console.log('hello there!')
  } else if (message.startsWith('follow ')) {
    const targetName = message.substring('follow '.length)
    const target = bot.players[targetName] ? bot.players[targetName].entity : bot.entities.find(e => e.name === targetName)

    if (!target || !target.entity) {
        console.log(`I can't see ${targetName}.`);
        return;
    }

    console.log(`Following ${targetName}`);

    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    const followGoal = new GoalFollow(target.entity, 3);
    bot.pathfinder.setGoal(followGoal, true);
  } else if (message.startsWith('hunt ')) {
    const targetName = message.substring('hunt '.length)
    const target = bot.entities.find(e => e.name === targetName && e.type === 'mob')

    if (!target) {
      console.log(`Could not find mob ${targetName}`)
      return
    }

    console.log(`Hunting ${targetName}`)

    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    // Set a goal to move towards the target
    bot.pathfinder.setGoal(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 1), true);

    if (currentHuntInterval) {
      clearInterval(currentHuntInterval)
    }

    currentHuntInterval = setInterval(() => {
      const distance = bot.entity.position.distanceTo(target.position)
      if (distance < 3) { // Attack when close enough
        bot.attack(target)
      }
              if (!target.isValid) { // Stop hunting if target is dead
                clearInterval(currentHuntInterval)
                console.log(`Finished hunting ${targetName}`)
                bot.pathfinder.stop() // Stop pathfinding
                currentHuntInterval = null
              }    }, 1000) // Check every second
  } else if (message === 'chop') {
    const treeBlock = bot.findBlock({
      matching: (block) => block.name.includes('log'),
      maxDistance: 64
    })

    if (treeBlock) {
      console.log('Chopping nearest tree...')
      bot.ashfinder.goto(treeBlock.position, () => {
        bot.dig(treeBlock, () => {
          console.log('Finished chopping tree.')
        })
      })
    } else {
      console.log('No trees found nearby.')
    }
  } else if (message === 'stop') {
    console.log('Stopping current action.')
    bot.ashfinder.stop() // Stop ashfinder (baritone)
    bot.pathfinder.stop() // Stop mineflayer-pathfinder

    if (currentHuntInterval) {
      clearInterval(currentHuntInterval)
      currentHuntInterval = null
    }
  }
})

bot.on('error', err => console.log(err))
bot.on('end', () => console.log('Disconnected'))
