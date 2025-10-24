require('dotenv').config()
const mineflayer = require('mineflayer')
const baritone = require('@miner-org/mineflayer-baritone').loader
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const { goals } = require('@miner-org/mineflayer-baritone')
const { Vec3 } = require('vec3')
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
let viewerInstance = null; // To store the prismarine-viewer instance
let webInventoryInstance = null; // To store the mineflayer-web-inventory instance

// Ollama Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:270m'; // Default to gemma:2b if not specified

// mcData needs to be accessible globally for handleBotMessage
let mcData;

// --- Settings Management ---
const settingsFilePath = path.join(__dirname, 'saves', 'settings.json');
let settings = {
    autoEat: true,
    autoDefend: true,
    autoSleep: true,
    whitelistedPlayers: []
};

const helpMessage = `
--- Bot Commands ---
In-Game Chat Commands (prefix with 'bloop' for AI interpretation):
  hi bot: Bot greets you.
  say <message>: Bot says <message> in chat.
  follow <player_name>: Bot follows the specified player.
  hunt <name> or kill <name>: Bot hunts the specified player or mob.
  chop: Bot chops the nearest tree.
  stop: Stops all current actions.
  goto <x> <y> <z> or goto <saved_location_name>: Bot navigates to a location.
  save <name>: Saves the bot's current position as a named location.
  list: Displays all saved locations.
  delete <name>: Deletes a saved location.
  status: Displays bot's health, food, and saturation.
  give items to <player_name>: Bot gives all its items to the specified player.
  quit or exit: Disconnects the bot (only by Luize26).
  help: Displays this help message.

Terminal Commands:
  say <message>: Bot says <message> in chat.
  follow <player_name>: Bot follows the specified player.
  goto <x> <y> <z> or goto <saved_location_name>: Bot navigates to a location.
  save <name>: Saves the bot's current position as a named location.
  list: Displays all saved locations.
  delete <name>: Deletes a saved location.
  chop: Bot chops the nearest tree.
  stop: Stops all current actions.
  status: Displays bot's health, food, and saturation.
  autoeat <on|off>: Enables or disables auto-eat.
  autodefend <on|off>: Enables or disables auto-defend.
  autosleep <on|off>: Enables or disables auto-sleep.
  setspawn: Sets spawn point to the nearest bed.
  give items to <player_name>: Bot gives all its items to the specified player.
  whitelist <add|remove> <player_name>: Manages whitelisted players.
  quit or exit: Disconnects the bot.
  help: Displays this help message.
`;

async function loadSettings() {
    try {
        const data = await fs.readFile(settingsFilePath, 'utf8');
        settings = { ...settings, ...JSON.parse(data) };
    } catch (err) {
        if (err.code === 'ENOENT') {
            await saveSettings(); // Create the file with default settings
        } else {
            throw err;
        }
    }
}

async function saveSettings() {
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
}

// --- Auto-Eat Feature ---
let isEating = false;
const EAT_THRESHOLD = 16; // Eat when food is at 8 hunger icons (16/20)

// --- Auto-Defend Feature ---

async function autoEat() {
    if (!settings.autoEat || isEating || bot.food >= EAT_THRESHOLD) {
        return;
    }

    const foodPriority = [
        'golden_apple', 'enchanted_golden_apple', 'golden_carrot',
        'cooked_porkchop', 'cooked_beef', 'cooked_salmon', 'cooked_mutton', 'cooked_chicken',
        'steak', 'porkchop', 'beef', 'salmon', 'mutton', 'chicken',
        'baked_potato', 'bread', 'apple', 'carrot', 'potato', 'beetroot'
    ];

    const items = bot.inventory.items();
    let bestFood = null;
    let bestPriority = -1;

    for (const item of items) {
        const priority = foodPriority.indexOf(item.name);
        if (priority !== -1 && priority > bestPriority) {
            bestFood = item;
            bestPriority = priority;
        }
    }

    if (!bestFood) {
        // Fallback to any food if no priority food is found
        bestFood = items.find(item => item.foodPoints > 0 && !item.name.includes('rotten_flesh') && !item.name.includes('spider_eye'));
    }

    if (!bestFood) {
        logError('No suitable food found in inventory.');
        return;
    }

    isEating = true;
    logAction('Hunger low, attempting to eat...');

    try {
        const heldItem = bot.heldItem;
        logAction(`Equipping and eating ${bestFood.displayName}...`);
        await bot.equip(bestFood, 'hand');
        await bot.consume();
        logAction('Finished eating.');

        // Re-equip previous item if it existed
        if (heldItem) {
            await bot.equip(heldItem, 'hand');
        }
    } catch (err) {
        logError(`Could not eat: ${err.message}`);
    } finally {
        isEating = false;
    }
}

// --- Auto-Sleep Feature ---
let isSleeping = false;

async function autoSleep() {
    if (!settings.autoSleep || isSleeping || bot.isSleeping) {
        return;
    }

    // Check if it's night time (between 13000 and 23000 ticks)
    if (bot.time.timeOfDay < 13000 || bot.time.timeOfDay > 23000) {
        return; // Not night time
    }

    isSleeping = true;
    logAction('It\'s night, attempting to sleep...');

    let bed = bot.inventory.items().find(item => item.name.includes('_bed'));
    let bedBlock = null;

    if (bed) {
        // Place bed from inventory
        logAction('Placing bed from inventory...');
        const bedPos = bot.entity.position.offset(0, 0, 1); // Attempt to place in front of bot
        const refBlock = bot.blockAt(bedPos.offset(0, -1, 0)); // Block below where bed will be placed

        if (!refBlock || refBlock.name === 'air') {
            logError('No solid block to place bed on.');
            isSleeping = false;
            return;
        }

        try {
            await bot.equip(bed, 'hand');
            await bot.placeBlock(refBlock, new Vec3(0, 1, 0)); // Place on top of refBlock
            bedBlock = bot.blockAt(bedPos);
            logAction('Bed placed.');
        } catch (err) {
            logError(`Could not place bed: ${err.message}`);
            isSleeping = false;
            return;
        }
    } else {
        // Find existing bed
        logAction('No bed in inventory, searching for nearby bed...');
        bedBlock = bot.findBlock({
            matching: block => block.name.includes('_bed'),
            maxDistance: 32
        });

        if (!bedBlock) {
            logError('No bed found nearby.');
            isSleeping = false;
            return;
        }
    }

    try {
        logAction('Sleeping in bed...');
        await bot.sleep(bedBlock);
        logAction('Woke up from sleeping.');

        // Break and collect bed after waking
        if (bedBlock) {
            logAction('Breaking and collecting bed...');
            await bot.dig(bedBlock);
            await bot.collectBlock.collect(bedBlock);
            logAction('Bed collected.');
        }
    } catch (err) {
        logError(`Could not sleep: ${err.message}`);
    } finally {
        isSleeping = false;
    }
}


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
          { role: 'system', content: 'You are a Minecraft bot that acts like a human player. Respond naturally and concisely.' },
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

async function handleBotMessage(username, message, isWhisper = false) {
  function respond(targetUsername, message, isWhisper) {
    if (isWhisper) {
      bot.whisper(targetUsername, message);
    } else {
      bot.chat(message);
    }
  }
  const [cmd, ...args] = message.trim().split(/\s+/);

  switch (cmd.toLowerCase()) {
    case 'hi':
      if (args[0] && args[0].toLowerCase() === 'bot') {
        respond(username, 'hello there!', isWhisper);
      }
      break;
    case 'say':
      const messageToSay = args.join(' ');
      respond(username, messageToSay, isWhisper);
      logAction(`Bot saying: "${messageToSay}"`);
      break;
    case 'follow': {
      const name = args[0];
      if (!name) return logError('Usage: follow <player>');
      const target = bot.players[name]?.entity || Object.values(bot.entities).find(e => e.name === name);
      if (!target) return logError(`Cannot see ${name}.`);

      logAction(`Following ${name}`);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);
      bot.pathfinder.setGoal(new GoalFollow(target, 3), true);
      break;
    }
    case 'hunt':
    case 'kill': {
      const targetName = args[0];
      // Check if the target is a whitelisted player
      if (settings.whitelistedPlayers.includes(targetName)) {
          logAction(`Player ${targetName} is whitelisted. Not attacking.`);
          return;
      }

      let target = bot.players[targetName]?.entity;
      if (!target) {
        target = Object.values(bot.entities).find(e => e.name === targetName && e.type === 'mob');
      }
      if (!target) {
          const aiResponse = await callOllama(`Execute the command: ${message}`);
          if (aiResponse) {
              handleBotMessage(username, aiResponse);
          } else {
              logError(`Could not find player or mob named ${targetName}.`);
          }
          return;
      }

      const bow = bot.inventory.findInventoryItem('bow');
      if (bow) {
        logAction(`Attacking ${targetName} with a bow!`);
        bot.hawkEye.autoAttack(target, 'bow');
      } else {
        logAction(`Attacking ${targetName} with melee.`);
        bot.pvp.attack(target);
      }
      break;
    }
    case 'chop': {
      const treeBlock = bot.findBlock({
        matching: block => block.name.includes('log'),
        maxDistance: 64
      });
      if (!treeBlock) return logError('No trees nearby.');

      logAction('Chopping nearest tree...');
      try {
        await bot.collectBlock.collect(treeBlock);
        logAction('Finished chopping tree.');
      } catch (err) {
        logError(err.message);
      }
      break;
    }
    case 'stop':
      logAction('Stopping all actions...');
      bot.ashfinder?.stop?.();
      bot.pathfinder.stop();
      bot.pvp.stop();
      break;
    case 'goto': {
      const locations = await loadLocations();
      const name = args[0];
      let goal;

      if (locations[name]) {
        const { x, y, z } = locations[name];
        goal = new goals.GoalExact(new Vec3(x, y, z));
        logAction(`Going to saved location "${name}" at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
      } else {
        const x = parseInt(args[0]);
        const y = parseInt(args[1]);
        const z = parseInt(args[2]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            const aiResponse = await callOllama(`Execute the command: ${message}`);
            if (aiResponse) {
                handleBotMessage(username, aiResponse);
            } else {
                logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>');
            }
            return;
        }
        goal = new goals.GoalExact(new Vec3(x, y, z));
        logAction(`Going to ${x}, ${y}, ${z}`);
      }
      bot.ashfinder.gotoSmart(goal);
      break;
    }
    case 'save': {
      const name = args[0];
      if (!name) return logError('Usage: save <name>');
      const locations = await loadLocations();
      const pos = bot.entity.position;
      locations[name] = { x: pos.x, y: pos.y, z: pos.z };
      await saveLocations(locations);
      logAction(`Location "${name}" saved at ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);
      break;
    }
    case 'list': {
      const locations = await loadLocations();
      const names = Object.keys(locations);
      if (names.length === 0) {
        logSystem('No locations saved.');
        break;
      }
      logSystem('Saved locations:');
      for (const locName of names) {
        const { x, y, z } = locations[locName];
        console.log(`  - ${locName}: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
      }
      break;
    }
    case 'delete': {
      const name = args[0];
      if (!name) return logError('Usage: delete <name>');
      const locations = await loadLocations();
      if (!locations[name]) {
        return logError(`Location "${name}" not found.`);
      }
      delete locations[name];
      await saveLocations(locations);
      logAction(`Location "${name}" deleted.`);
      break;
    }
    case 'status': {
      logSystem(`Health: ${bot.health.toFixed(1)}/20 | Food: ${bot.food.toFixed(1)}/20 | Saturation: ${bot.foodSaturation.toFixed(2)}`);
      break;
    }
    case 'give': {
        if (args[0] === 'items' && args[1] === 'to') {
            const playerName = args[2];
            if (!playerName) return logError('Usage: give items to <player_name>');
            const target = bot.players[playerName]?.entity;
            if (!target) return logError(`Cannot see player ${playerName}.`);

            logAction(`Giving all items to ${playerName}...`);
            for (const item of bot.inventory.items()) {
                try {
                    await bot.tossStack(item);
                } catch (err) {
                    logError(`Could not toss ${item.name}: ${err.message}`);
                }
            }
            logAction('Finished giving items.');
        }
        break;
    }
    case 'help':
      respond(username, helpMessage, isWhisper);
      break;
    case 'quit':
    case 'exit':
      if (username === 'Luize26') {
        logAction('Received quit/exit command via chat/whisper. Exiting...');
        isIntentionalExit = true;
        bot.end();
      } else {
        logError('Only Luize26 can issue quit/exit commands via chat/whisper.');
      }
      break;
    default:
      // If no command matched, check for 'bloop' for AI response
      if (message.toLowerCase().includes('bloop')) {
        logAction(`Responding to 'bloop' in chat from ${username} using Ollama (Host: ${OLLAMA_HOST}, Port: ${OLLAMA_PORT}, Model: ${OLLAMA_MODEL})...`);
        const aiResponse = await callOllama(message);
        if (aiResponse) {
          respond(username, aiResponse, isWhisper);
        } else {
          logError('Ollama API call failed or returned no response. Check Ollama server and model.');
          respond(username, 'I am unable to respond right now.', isWhisper);
        }
      } else {
        // If not a recognized command and no 'bloop', try AI command interpretation
        const aiResponse = await callOllama(`Execute the command: ${message}`);
        if (aiResponse) {
            handleBotMessage(username, aiResponse);
        } else {
            logError(`Unknown in-game command or AI trigger: ${message}`);
        }
      }
      break;
  }
}

async function startBot() {
  isIntentionalExit = false; // Reset flag on new bot creation
  await loadSettings();
  bot = mineflayer.createBot({
    host: process.env.MC_HOST,
    port: 25565,
    username: 'Bloop',
    version: '1.21.8'
  })

  mcData = require('minecraft-data')(bot.version) // Assign to global mcData

  bot.loadPlugin(baritone)
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(minecraftHawkEye.default || minecraftHawkEye)
  bot.loadPlugin(toolPlugin)
  bot.loadPlugin(pvp)
  bot.loadPlugin(armorManager)
  bot.loadPlugin(collectBlock)

  // Initialize web inventory viewer only once, with port hopping
  if (!webInventoryInstance) {
    const startPort = 3000;
    const maxPortAttempts = 5;
    for (let i = 0; i < maxPortAttempts; i++) {
      const port = startPort + i;
      try {
        webInventoryInstance = inventoryViewer(bot, { port: port });
        logSystem(`Inventory web server running on *:${port}`);
        break; // Successfully started, exit loop
      } catch (err) {
        if (err.code === 'EADDRINUSE') {
          logError(`Port ${port} is in use for web inventory. Trying next port...`);
          if (i === maxPortAttempts - 1) {
            logError('All attempts to find a free port for web inventory failed.');
            webInventoryInstance = null; // Ensure webInventoryInstance is null if all attempts fail
          }
        } else {
          throw err; // Re-throw other errors
        }
      }
    }
  }

  // --- Bot Events ---
  bot.on('health', autoEat);
  bot.on('death', async () => {
    logSystem('Bot died. Respawning...');
    try {
      await bot.respawn()
    } catch (err) {
      logError(`Error respawning: ${err.message}`)
    }
  });
  bot.on('entityHurt', (entity) => {
    if (settings.autoDefend && entity === bot.entity) {
        const attacker = entity.attacker; // Use entity.attacker to get the actual attacker
        if (attacker && attacker.id !== bot.entity.id) { // Ensure attacker exists and is not self
            // Check if the attacker is a whitelisted player
            if (attacker.type === 'player' && settings.whitelistedPlayers.includes(attacker.username)) {
                logAction(`Attacked by whitelisted player ${attacker.username}. Not retaliating.`);
                return;
            }

            logAction(`Attacked by ${attacker.username || attacker.name || 'an unknown entity'}! Retaliating.`);
            const bow = bot.inventory.findInventoryItem('bow');
            if (bow) {
                bot.hawkEye.autoAttack(attacker, 'bow');
            } else {
                bot.pvp.attack(attacker);
            }
        }
    }
  });
  bot.on('entityGone', async (entity) => {
      if (entity.type === 'mob') {
          setTimeout(async () => {
              const items = bot.findBlocks({ matching: (block) => block.name.includes('air'), maxDistance: 16, point: entity.position });
              for (const item of items) {
                  const block = bot.blockAt(item);
                  if (block && block.name !== 'air') {
                      try {
                          await bot.collectBlock.collect(block);
                      } catch (err) {
                          logError(`Could not collect ${block.name}: ${err.message}`);
                      }
                  }
              }
          }, 1000);
      }
  });
  bot.on('spawn', () => {
    logSystem('Bot spawned!')
    // Initialize prismarine-viewer only once, with port hopping
    if (!viewerInstance) {
      const startPort = 3008;
      const maxPortAttempts = 5;
      for (let i = 0; i < maxPortAttempts; i++) {
        const port = startPort + i;
        try {
          viewerInstance = mineflayerViewer(bot, { port: port, firstPerson: false });
          logSystem(`Prismarine viewer web server running on *:${port}`);
          break; // Successfully started, exit loop
        } catch (err) {
          if (err.code === 'EADDRINUSE') {
            logError(`Port ${port} is in use. Trying next port...`);
            if (i === maxPortAttempts - 1) {
              logError('All attempts to find a free port for prismarine-viewer failed.');
              viewerInstance = null; // Ensure viewerInstance is null if all attempts fail
            }
          } else {
            throw err; // Re-throw other errors
          }
        }
      }
    }
    bot.armorManager.equipAll()
  })

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return; // Ignore own messages
    //if (username !== 'Luize26' && username !== bot.username) return;
    logChat(username, message)
    await handleBotMessage(username, message, false); // Pass false for isWhisper
  })

  bot.on('whisper', async (username, message) => {
    if (username !== 'Luize26') return;
    logChat(username, `[WHISPER] ${message}`);
    await handleBotMessage(username, message, true); // Pass true for isWhisper
  })

  bot.on('error', err => logError(err))
  bot.on('end', (reason) => {
    if (isIntentionalExit) {
      logSystem('Exiting now.');
      // Close web servers on intentional exit
      if (viewerInstance && viewerInstance.close) {
        viewerInstance.close();
        viewerInstance = null;
      }
      if (webInventoryInstance && webInventoryInstance.close) {
        webInventoryInstance.close();
        webInventoryInstance = null;
      }
      rl.close();
      process.exit(0);
    } else {
      logSystem(`Disconnected: ${reason}. Reconnecting in 5 seconds...`)
      // Attempt to close web servers on unexpected disconnect before reconnecting
      if (viewerInstance && viewerInstance.close) {
        viewerInstance.close();
        viewerInstance = null;
      }
      if (webInventoryInstance && webInventoryInstance.close) {
        webInventoryInstance.close();
        webInventoryInstance = null;
      }
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
        goal = new goals.GoalExact(new Vec3(x, y, z))
        logAction(`Going to saved location "${name}" at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`)
      } else {
        const x = parseInt(args[0])
        const y = parseInt(args[1])
        const z = parseInt(args[2])
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            const aiResponse = await callOllama(`Execute the command: ${input}`); // Use input here
            if (aiResponse) {
                handleBotMessage(null, aiResponse); // Pass null for username as it's from terminal
            } else {
                logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>');
            }
            return;
        }
        goal = new goals.GoalExact(new Vec3(x, y, z))
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
      logAction(`Location "${name}" saved at ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`)
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
      for (const locName of names) {
        const { x, y, z } = locations[locName]
        console.log(`  - ${locName}: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`)
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
      logAction(`Location "${name}" deleted.`);
      break;
    }
    case 'chop': {
      const tree = bot.findBlock({ matching: b => b.name.includes('log'), maxDistance: 64 });
      if (!tree) return logError('No trees nearby.');
      logAction('Chopping tree...');
      await bot.collectBlock.collect(tree);
      break;
    }
    case 'stop':
      bot.pathfinder.stop();
      bot.pvp.stop();
      bot.ashfinder?.stop?.();
      logAction('Stopped.');
      break;
    case 'status': {
      logSystem(`Health: ${bot.health.toFixed(1)}/20 | Food: ${bot.food.toFixed(1)}/20 | Saturation: ${bot.foodSaturation.toFixed(2)}`);
      break;
    }
    case 'autoeat': {
        const arg = args[0];
        if (arg === 'on') {
            settings.autoEat = true;
            logSystem('Auto-eat enabled.');
        } else if (arg === 'off') {
            settings.autoEat = false;
            logSystem('Auto-eat disabled.');
        } else {
            logError('Usage: autoeat <on|off>');
        }
        await saveSettings();
        break;
    }
    case 'autodefend': {
        const arg = args[0];
        if (arg === 'on') {
            settings.autoDefend = true;
            logSystem('Auto-defend enabled.');
        } else if (arg === 'off') {
            settings.autoDefend = false;
            logSystem('Auto-defend disabled.');
        }
        await saveSettings();
        break;
    }
    case 'autosleep': {
        const arg = args[0];
        if (arg === 'on') {
            settings.autoSleep = true;
            logSystem('Auto-sleep enabled.');
        } else if (arg === 'off') {
            settings.autoSleep = false;
            logSystem('Auto-sleep disabled.');
        }
        await saveSettings();
        break;
    }
    case 'setspawn': {
        const bedBlock = bot.findBlock({
            matching: block => bot.isABed(block),
            maxDistance: 32
        });
        if (!bedBlock) return logError('No bed found nearby to set spawn.');

        try {
            await bot.activateBlock(bedBlock);
            logAction('Spawn point set at bed.');
        } catch (err) {
            logError(`Could not set spawn: ${err.message}`);
        }
        break;
    }
    case 'give': {
        if (args[0] === 'items' && args[1] === 'to') {
            const playerName = args[2];
            if (!playerName) return logError('Usage: give items to <player_name>');
            const target = bot.players[playerName]?.entity;
            if (!target) return logError(`Cannot see player ${playerName}.`);

            logAction(`Giving all items to ${playerName}...`);
            for (const item of bot.inventory.items()) {
                try {
                    await bot.tossStack(item);
                } catch (err) {
                    logError(`Could not toss ${item.name}: ${err.message}`);
                }
            }
            logAction('Finished giving items.');
        }
        break;
    }
    case 'whitelist': {
        const action = args[0];
        const playerName = args[1];

        if (!action || !playerName) {
            logError('Usage: whitelist <add|remove> <player_name>');
            break;
        }

        if (action === 'add') {
            if (!settings.whitelistedPlayers.includes(playerName)) {
                settings.whitelistedPlayers.push(playerName);
                logSystem(`Added ${playerName} to whitelist.`);
            } else {
                logSystem(`${playerName} is already in the whitelist.`);
            }
        } else if (action === 'remove') {
            const index = settings.whitelistedPlayers.indexOf(playerName);
            if (index > -1) {
                settings.whitelistedPlayers.splice(index, 1);
                logSystem(`Removed ${playerName} from whitelist.`);
            } else {
                logSystem(`${playerName} is not in the whitelist.`);
            }
        } else {
            logError('Usage: whitelist <add|remove> <player_name>');
        }
        await saveSettings();
        break;
    }
    case 'help':
      logSystem(helpMessage);
      break;
    case 'quit':
    case 'exit':
      isIntentionalExit = true;
      bot.end();
      break;
    default:
      const aiResponse = await callOllama(`Execute the command: ${input}`); // Use input here
      if (aiResponse) {
          handleBotMessage(null, aiResponse); // Pass null for username as it's from terminal
      } else {
          logError(`Unknown command: ${cmd}`);
      }
      break;
  }
});

// Initial bot creation
startBot();