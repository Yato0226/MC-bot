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
const fs = require('fs').promises
const path = require('path')
const util = require('util')

// --- Comprehensive Logging System ---
const logFilePath = path.join(__dirname, 'saves', 'sys.log');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function stripAnsi (str) {
  return str.replace(/[\u001b\u009b][[()#;?]*.{0,2}?[0-9@A-Z\\=a-z~]/g, '');
}

async function logToFile (message) {
  const timestamp = new Date().toISOString();
  const cleanMessage = stripAnsi(util.format.apply(null, message));
  const logMessage = `[${timestamp}] ${cleanMessage}\n`;
  try {
    await fs.appendFile(logFilePath, logMessage);
  } catch (err) {
    originalConsoleError('Failed to write to log file:', err);
  }
}

console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  logToFile(args);
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
  logToFile(['ERROR:', ...args]);
};

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

// --- File System for Saved Locations ---
const locationsFilePath = path.join(__dirname, 'saves', 'locations.json')

async function loadLocations () {
  try {
    const data = await fs.readFile(locationsFilePath, 'utf8')
    return JSON.parse(data)
  } catch (err) {
    if (err.code === 'ENOENT') return {} // File doesn't exist
    throw err
  }
}

async function saveLocations (locations) {
  await fs.writeFile(locationsFilePath, JSON.stringify(locations, null, 2))
}

// --- Custom Log System ---
function logSystem (msg) {
  console.log(chalk.default.gray(`[SYSTEM] ${msg}`))
}

function logChat (user, msg) {
  console.log(chalk.default.cyan(`[CHAT] ${user}: `) + chalk.default.white(msg))
}

function logAction (msg) {
  console.log(chalk.default.green(`[ACTION] ${msg}`))
}

function logError (msg) {
  console.error(chalk.default.red(`[ERROR] ${msg}`))
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
    } else if (message.startsWith('hunt ') || message.startsWith('kill ')) {
      const prefix = message.startsWith('hunt ') ? 'hunt ' : 'kill ';
      const targetName = message.substring(prefix.length)
      let target = bot.players[targetName]?.entity
      if (!target) {
        target = bot.entities.find(e => e.name === targetName && e.type === 'mob')
      }
      if (!target) return logError(`Could not find player or mob named ${targetName}.`)

      const bow = bot.inventory.findInventoryItem('bow')
      if (bow) {
        logAction(`Attacking ${targetName} with a bow!`)
        bot.hawkEye.autoAttack(target, 'bow')
      } else {
        logAction(`Attacking ${targetName} with melee.`)
        bot.pvp.attack(target)
      }
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
  logToFile([`TERMINAL COMMAND: ${input}`]);
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
    case 'goto': {
      const locations = await loadLocations()
      const name = args[0]
      let goal

      if (locations[name]) {
        const { x, y, z } = locations[name]
        goal = new goals.GoalExact(x, y, z)
        logAction(`Going to saved location "${name}" at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`)
      } else {
        const x = parseInt(args[0])
        const y = parseInt(args[1])
        const z = parseInt(args[2])
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          return logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>')
        }
        goal = new goals.GoalExact(x, y, z)
        logAction(`Going to ${x}, ${y}, ${z}`)
      }
      bot.ashfinder.gotoSmart(goal)
      break
    }
    case 'save': {
      const name = args[0]
      if (!name) return logError('Usage: save <name>')
      const locations = await loadLocations()
      const pos = bot.entity.position
      locations[name] = { x: pos.x, y: pos.y, z: pos.z }
      await saveLocations(locations)
      logAction(`Location "${name}" saved at ${pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1)}`)
      break
    }
    case 'list': {
      const locations = await loadLocations()
      const names = Object.keys(locations)
      if (names.length === 0) {
        logSystem('No locations saved.')
        break
      }
      logSystem('Saved locations:')
      for (const name of names) {
        const { x, y, z } = locations[name]
        console.log(`  - ${name}: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`)
      }
      break
    }
    case 'delete': {
      const name = args[0]
      if (!name) return logError('Usage: delete <name>')
      const locations = await loadLocations()
      if (!locations[name]) {
        return logError(`Location "${name}" not found.`)
      }
      delete locations[name]
      await saveLocations(locations)
      logAction(`Location "${name}" deleted.`)
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