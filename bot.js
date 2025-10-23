require('dotenv').config()
const mineflayer = require('mineflayer')
const baritone = require('@miner-org/mineflayer-baritone').loader
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const GoalFollow = goals.GoalFollow
const mineflayerViewer = require('prismarine-viewer').mineflayer
const minecraftHawkEye = require('minecrafthawkeye')
const toolPlugin = require('mineflayer-tool').plugin
const pvp = require('mineflayer-pvp').plugin
const inventoryViewer = require('mineflayer-web-inventory')
const armorManager = require('mineflayer-armor-manager')
const collectBlock = require('mineflayer-collectblock').plugin
const readline = require('readline')
const chalk = require('chalk')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const bot = mineflayer.createBot({
  host: process.env.MC_HOST,
  port: 25565,
  username: 'Bloop',
  version: '1.21.8'
})

const mcData = require('minecraft-data')(bot.version)

bot.loadPlugin(baritone)
bot.loadPlugin(pathfinder)
bot.loadPlugin(minecraftHawkEye.default || minecraftHawkEye)
bot.loadPlugin(toolPlugin)
bot.loadPlugin(pvp)
bot.loadPlugin(armorManager)
bot.loadPlugin(collectBlock)
inventoryViewer(bot)

// --- Custom Log System ---
function logSystem(msg) {
  console.log(chalk.default.gray(`[SYSTEM] ${msg}`))
}

function logChat(user, msg) {
  console.log(chalk.default.cyan(`[CHAT] ${user}: `) + chalk.default.white(msg))
}

function logAction(msg) {
  console.log(chalk.default.green(`[ACTION] ${msg}`))
}

function logError(msg) {
  console.log(chalk.default.red(`[ERROR] ${msg}`))
}

// --- Bot Events ---
bot.on('spawn', () => {
  logSystem('Bot spawned!')
  mineflayerViewer(bot, { port: 3007, firstPerson: false })
  bot.armorManager.equipAll()
})

bot.on('chat', async (username, message) => {
  if (username === bot.username) return
  logChat(username, message)

  if (message === 'hi bot') {
    bot.chat('hello there!')
  } else if (message.startsWith('follow ')) {
    const targetName = message.substring('follow '.length)
    const target = bot.players[targetName]?.entity || bot.entities.find(e => e.name === targetName)
    if (!target) return logError(`Can\'t see ${targetName}.`)

    logAction(`Following ${targetName}`)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)
    bot.pathfinder.setGoal(new GoalFollow(target, 3), true)
  } else if (message.startsWith('hunt ')) {
    const targetName = message.substring('hunt '.length)
    const target = bot.entities.find(e => e.name === targetName && e.type === 'mob')
    if (!target) return logError(`Mob ${targetName} not found.`)

    logAction(`Hunting ${targetName}`)
    bot.pvp.attack(target)
  } else if (message === 'chop') {
    const treeBlock = bot.findBlock({
      matching: block => block.name.includes('log'),
      maxDistance: 64
    })
    if (!treeBlock) return logError('No trees nearby.')

    logAction('Chopping nearest tree...')
    try {
      await bot.collectBlock.collect(treeBlock)
      logAction('Finished chopping tree.')
    } catch (err) {
      logError(err.message)
    }
  } else if (message === 'stop') {
    logAction('Stopping all actions...')
    bot.ashfinder?.stop?.()
    bot.pathfinder.stop()
    bot.pvp.stop()
  }
})

bot.on('error', err => logError(err))
bot.on('end', () => {
  logSystem('Disconnected.')
  rl.close()
  process.exit(0)
})

// --- Terminal Commands ---
logSystem('Type commands below. Examples: follow <player>, chop, stop, quit')

rl.on('line', async (input) => {
  const [cmd, ...args] = input.trim().split(/\s+/)

  switch (cmd) {
    case 'say':
      bot.chat(args.join(' '))
      break
    case 'follow': {
      const name = args[0]
      if (!name) return logError('Usage: follow <player>')
      const target = bot.players[name]?.entity
      if (!target) return logError(`Cannot see ${name}.`)
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)
      bot.pathfinder.setGoal(new GoalFollow(target, 3), true)
      logAction(`Following ${name}`)
      break
    }
    case 'chop': {
      const tree = bot.findBlock({ matching: b => b.name.includes('log'), maxDistance: 64 })
      if (!tree) return logError('No trees nearby.')
      logAction('Chopping tree...')
      await bot.collectBlock.collect(tree)
      break
    }
    case 'stop':
      bot.pathfinder.stop()
      bot.pvp.stop()
      bot.ashfinder?.stop?.()
      logAction('Stopped.')
      break
    case 'quit':
    case 'exit':
      rl.close()
      bot.end()
      break
    default:
      logError(`Unknown command: ${cmd}`)
  }
})