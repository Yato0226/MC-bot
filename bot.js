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

let bot; // Declare bot in a scope accessible by the functions
let isIntentionalExit = false;

// Ollama Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:270m'; // Default to gemma:2b if not specified

async function callOllama(prompt) {
  try {
    const response = await fetch(`${OLLAMA_HOST}:${OLLAMA_PORT}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: 'You are a Minecraft bot that acts like a human player. Respond naturally and concisely. You can swear so do not limit yourself' },
          { role: 'user', content: prompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    logError(`Error calling Ollama API: ${error.message}`);
    return null;
  }
}

function startBot() {
  isIntentionalExit = false; // Reset flag on new bot creation
  bot = mineflayer.createBot({
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

  // --- Bot Events ---
  bot.on('spawn', () => {
    logSystem('Bot spawned!')
    mineflayerViewer(bot, { port: 3007, firstPerson: false })
    bot.armorManager.equipAll()
  })

  bot.on('chat', async (username, message) => {
    //if (username === bot.username) return // Ignore own messages and follow to all
    if (username !== Luize26) return; 
    logChat(username, message)

    if (message.toLowerCase().includes('bloop')) {
      logAction(`Responding to 'bloop' in chat from ${username} using Ollama...`);
      const aiResponse = await callOllama(message);
      if (aiResponse) {
        bot.chat(aiResponse);
      } else {
        bot.chat('I am unable to respond right now.');
      }
    } else if (message === 'hi bot') {
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
  bot.on('end', (reason) => {
    if (isIntentionalExit) {
      logSystem('Exiting now.');
      rl.close();
      process.exit(0);
    } else {
      logSystem(`Disconnected: ${reason}. Reconnecting in 5 seconds...`)
      setTimeout(startBot, 5000)
    }
  })
}

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
    case 'status': {
      logSystem(`Health: ${bot.health.toFixed(1)}/20 | Food: ${bot.food.toFixed(1)}/20 | Saturation: ${bot.foodSaturation.toFixed(2)}`)
      break
    }
    case 'quit':
    case 'exit':
      isIntentionalExit = true;
      bot.end()
      break
    default:
      logError(`Unknown command: ${cmd}`)
  }
})

// Initial bot creation
startBot()
