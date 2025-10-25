require('dotenv').config()
const mineflayer = require('mineflayer')
const baritone = require('@miner-org/mineflayer-baritone').loader
const { pathfinder, Movements, goals: pathfinderGoals } = require('mineflayer-pathfinder')
const { goals: baritoneGoals } = require('@miner-org/mineflayer-baritone')
const { Vec3 } = require('vec3')
const GoalFollow = baritoneGoals.GoalFollow
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
let pathfinderListenersAttached = false;
let isAttacking = false;
let isFleeing = false;

// Ollama Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:270m';

// mcData needs to be accessible globally for handleBotMessage
let mcData;

// --- Settings Management ---
const settingsFilePath = path.join(__dirname, 'saves', 'settings.json');
let settings = {
    autoEat: true,
    autoDefend: true,
    autoSleep: true,
    autoFlee: true,
    fleeHealthThreshold: 8,
    whitelistedPlayers: []
};

async function runForSafety() {
    if (!settings.autoFlee || isFleeing || bot.health >= settings.fleeHealthThreshold) {
        return;
    }

    isFleeing = true;
    logAction('Low health, running for safety!');

    // Stop current actions
    bot.pvp.stop();
    bot.hawkEye.stop();
    bot.pathfinder.stop();
    bot.ashfinder?.stop?.();

    // Determine a flee goal
    // For now, a simple goal: move away from the nearest hostile entity or just a random direction
    const hostileEntity = bot.nearestEntity((e) => {
        const isHostileMob = e.type === 'mob' && e.mobType && !['Bat', 'Squid', 'Cod', 'Salmon', 'Pufferfish', 'Tropical Fish', 'Dolphin', 'Turtle', 'Strider', 'Glow Squid', 'Axolotl', 'Frog', 'Allay', 'Sniffer'].includes(e.mobType);
        const isPlayer = e.type === 'player';
        return (isPlayer || isHostileMob) && e.position.distanceTo(bot.entity.position) < 32; // Search within 32 blocks
    });

    let fleeGoal;
    if (hostileEntity) {
        // Move in the opposite direction of the hostile entity
        const direction = bot.entity.position.minus(hostileEntity.position).normalize();
        const fleePoint = bot.entity.position.plus(direction.scaled(10)); // Move 10 blocks away
        fleeGoal = new baritoneGoals.GoalExact(fleePoint.x, fleePoint.y, fleePoint.z);
        logAction(`Fleeing from ${hostileEntity.displayName} to ${fleePoint.x.toFixed(1)}, ${fleePoint.y.toFixed(1)}, ${fleePoint.z.toFixed(1)}`);
    } else {
        // If no hostile entity, just move in a random direction
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDirection = new Vec3(Math.cos(randomAngle), 0, Math.sin(randomAngle));
        const fleePoint = bot.entity.position.plus(randomDirection.scaled(10));
        fleeGoal = new baritoneGoals.GoalExact(fleePoint.x, fleePoint.y, fleePoint.z);
        logAction(`Fleeing in a random direction to ${fleePoint.x.toFixed(1)}, ${fleePoint.y.toFixed(1)}, ${fleePoint.z.toFixed(1)}`);
    }

    try {
        await bot.ashfinder.gotoSmart(fleeGoal);
        logAction('Reached safety point.');
    } catch (err) {
        logError(`Failed to reach safety point: ${err.message}`);
    } finally {
        isFleeing = false;
    }
}

const helpMessage = `
--- Bot Commands ---
In-Game Chat Commands (prefix with 'bloop' for AI interpretation):
  AI Command Interpretation: If a command is not recognized, it will be sent to the Ollama AI for interpretation. The AI will attempt to return a structured JSON command. For example, 'hunt all zombies' will be interpreted by the AI and executed.
  AI Chat: If a message contains the word "bloop", the bot will respond using the configured Ollama model.
  hi bot: Bot greets you.
  say <message>: Bot says <message> in chat.
  follow <player_name>: Bot follows the specified player.
  hunt <name> or kill <name>: Bot hunts the specified player or mob. Can accept multiple targets if interpreted by AI.
  chop: Bot chops the nearest tree.
  stop: Stops all current actions.
  goto <x> <y> <z> or goto <saved_location_name>: Bot navigates to a location. Can accept coordinates from AI.
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
const EAT_THRESHOLD = 16; // Eat when food is at 8 hunger icons (16/20)
const HEALTH_EAT_THRESHOLD = 15; // Eat when health is below 15 (7.5 hearts)
const MAX_EAT_RETRIES = 3; // Max retries for eating

async function autoEat() {
    // Check if autoEat is enabled, bot is already eating, or food/health is sufficient
    if (!settings.autoEat || bot.isEating || (bot.food >= EAT_THRESHOLD && bot.health >= HEALTH_EAT_THRESHOLD)) {
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

    logAction('Hunger low or health low, attempting to eat...');

    const heldItem = bot.heldItem;
    let retries = 0;
    let eatenSuccessfully = false;

    while (retries < MAX_EAT_RETRIES && !eatenSuccessfully) {
        try {
            logAction(`Equipping and eating ${bestFood.displayName}... (Attempt ${retries + 1}/${MAX_EAT_RETRIES})`);
            await bot.equip(bestFood, 'hand');
            await bot.consume();
            logAction('Finished eating.');
            eatenSuccessfully = true;
        } catch (err) {
            /*if (err.message.includes('Food is full') || err.message.includes('Consuming cancelled')) {
                logSystem(`Auto-eat: ${err.message}`); // Use logSystem for less critical messages
            } else if (err.message.includes('Cannot read properties of null')) {
                logError(`Auto-eat critical error: ${err.message} (This usually happens if inventory state changes unexpectedly during eating)`);
            } else {
                logError(`Could not eat: ${err.message} (Attempt ${retries + 1}/${MAX_EAT_RETRIES})`);
            }
            retries++;*/
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Re-equip previous item if it existed
    if (heldItem) {
        await bot.equip(heldItem, 'hand');
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
        let placed = false;
        const possibleBedPositions = [
            bot.entity.position.offset(0, 0, 1), // In front
            bot.entity.position.offset(0, 0, -1), // Behind
            bot.entity.position.offset(1, 0, 0), // Right
            bot.entity.position.offset(-1, 0, 0)  // Left
        ];

        for (const bedPos of possibleBedPositions) {
            const refBlock = bot.blockAt(bedPos.offset(0, -1, 0)); // Block below where bed will be placed
            if (refBlock && refBlock.name !== 'air' && refBlock.boundingBox === 'block') { // Ensure solid block below
                try {
                    await bot.equip(bed, 'hand');
                    await bot.placeBlock(refBlock, new Vec3(0, 1, 0)); // Place on top of refBlock
                    bedBlock = bot.blockAt(bedPos);
                    if (bedBlock && bedBlock.name.includes('_bed')) {
                        logAction(`Bed placed at ${bedPos.x.toFixed(1)}, ${bedPos.y.toFixed(1)}, ${bedPos.z.toFixed(1)}.`);
                        placed = true;
                        break;
                    }
                } catch (err) {
                    logSystem(`Attempted to place bed at ${bedPos.x.toFixed(1)}, ${bedPos.y.toFixed(1)}, ${bedPos.z.toFixed(1)} but failed: ${err.message}`);
                }
            }
        }

        if (!placed) {
            logError('Could not find a suitable spot to place the bed.');
            isSleeping = false;
            return;
        }
    } else {
        // Find existing bed
        logAction('No bed in inventory, searching for nearby bed...');
        bedBlock = bot.findBlock({
            matching: block => block.name.includes('_bed'),
            maxDistance: 64
        });
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

// --- Melee Weapon Management ---
function getBestMeleeWeapon() {
    let bestWeapon = null;
    let maxDamage = 0;

    for (const item of bot.inventory.items()) {
        // Consider swords and axes as melee weapons
        if (item.name.includes('sword') || item.name.includes('axe')) {
            // Temporarily equip the item to get its attack damage
            // This is a workaround as bot.getAttackDamage requires the item to be equipped
            // Or we can pass the item directly if the API supports it without equipping
            // Let's assume bot.getAttackDamage can take an item object directly for now.
            // If not, we'll need a more complex temporary equip/unequip logic.
            const damage = bot.getAttackDamage(item);
            if (damage > maxDamage) {
                maxDamage = damage;
                bestWeapon = item;
            }
        }
    }
    return bestWeapon;
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
          { 
                        role: 'system',
                        content: 'You are a Minecraft bot. Your task is to convert user requests into structured JSON commands. Your response MUST be a valid JSON object and contain NOTHING else. Do NOT include any conversational text, explanations, or markdown formatting outside of the JSON object itself. \n' +
                                 'Examples:\n' +
                                 '- User: "hunt the sheep and the zombie"\n' +
                                 '- You: { "command": "hunt", "targets": ["sheep", "zombie"] }\n' +
                                 '- User: "go to -100 64 50"\n' +
                                 '- You: { "command": "goto", "x": -100, "y": 64, "z": 50 }\n' +
                                 '- User: "how are you?"\n' +
                                 '- You: { "command": "chat", "message": "I am a bot, I am doing well!" }\n' +
                                 'If the request is conversational, use the "chat" command. If a command is not recognized, respond with { "command": "unknown" }.'          },
          { role: 'user', content: prompt }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    // Clean up potential markdown code blocks from the AI response
    const cleanedContent = data.message.content.replace(/```json\n|```/g, '').trim();
    return cleanedContent;
  } catch (error) {
    logError(`Error calling Ollama API: ${error.message}`);
    return null;
  }
}

async function handleBotMessage(username, message, isWhisper = false) {
  // --- Comprehensive Permission System ---

  // Define command access levels. AI-interpreted commands will be checked against these lists.
  const adminCommands = ['quit', 'exit', 'whitelist', 'autoeat', 'autodefend', 'autosleep', 'give'];
  const trustedCommands = ['follow', 'hunt', 'kill', 'goto', 'save', 'delete', 'setspawn', 'chop'];
  // Public commands don't need to be listed; they are anything not in the lists above.

  // Determine the command being issued, whether it's from a string or an AI object.
  let potentialCmd = '';
  if (typeof message === 'object' && message.command) {
    potentialCmd = message.command.toLowerCase();
  } else if (typeof message === 'string') {
    potentialCmd = message.trim().split(/\s+/)[0].toLowerCase();
  }

  // Check permissions. The admin (Luize26) bypasses all checks.
  if (username && username !== 'Luize26') {
    // 1. Check for admin commands
    if (adminCommands.includes(potentialCmd)) {
      /*logError(`Unauthorized attempt to use ADMIN command "${potentialCmd}" by user "${username}".`);
      respond(username, "I'm sorry, that command is for the bot owner only.", isWhisper);*/
      return; // Stop processing immediately.
    }
    // 2. Check for trusted commands
    if (trustedCommands.includes(potentialCmd) && !settings.trustedUsers.includes(username)) {
      /*logError(`Unauthorized attempt to use TRUSTED command "${potentialCmd}" by user "${username}".`);
      respond(username, "I'm sorry, you don't have permission to use that command.", isWhisper);*/
      return; // Stop processing immediately.
    }
  }
  // --- End of Permission System ---


  function respond(targetUsername, message, isWhisper) {
    if (isWhisper) {
      bot.whisper(targetUsername, message);
    } else {
      bot.chat(message);
    }
  }
  let cmd, args;
  let aiCommand = null;

  // --- THIS IS THE MISSING PARSING LOGIC ---
  if (typeof message === 'object' && message.command) {
    // This is a pre-parsed command from the AI
    aiCommand = message;
    cmd = message.command;
    args = []; // Arguments are handled inside the cases based on the aiCommand object
  } else if (typeof message === 'string') {
    // This is a regular string message from chat or terminal
    const parts = message.trim().split(/\s+/);
    cmd = parts[0];
    args = parts.slice(1);
  }

  // If after parsing there's no command, do nothing.
  if (!cmd) {
    return;
  }
  // --- END OF FIX ---

  // (The rest of your function from this point down remains exactly the same...)
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
      bot.pathfinder.setGoal(new pathfinderGoals.GoalFollow(target, 3), true);
      break;
    }
    case 'hunt':
    case 'kill': {
      if (isAttacking) {
        respond(username, 'I am already attacking something!', isWhisper);
        break;
      }

      let targetsToHunt = [];
      // Handles AI commands like "kill the sheep and the zombie"
      if (aiCommand && aiCommand.targets && Array.isArray(aiCommand.targets)) {
        targetsToHunt = aiCommand.targets;
      } else if (args.length > 0) {
        targetsToHunt = args; // Handles manual chat commands like "kill sheep zombie"
      }

      if (targetsToHunt.length === 0) {
        logError('Usage: hunt <name> or kill <name>');
        break;
      }

      for (const targetName of targetsToHunt) {
        if (!targetName) continue;

        if (settings.whitelistedPlayers.includes(targetName)) {
            logAction(`Player ${targetName} is whitelisted. Not attacking.`);
            continue;
        }

        // This is the corrected search logic you already implemented
                let target = bot.players[targetName]?.entity;
                if (!target) {
                  logSystem('--- Debug: Nearby Entities ---');
                  Object.values(bot.entities).forEach(e => {
                    logSystem(`Entity: Type=${e.type}, Name=${e.name}, DisplayName=${e.displayName?.toString()}`);
                  });
                  logSystem('--- End Debug ---');
                  const lowerCaseTargetName = targetName.toLowerCase();
                  target = bot.nearestEntity(entity => {                    if (!(entity.type === 'mob' || entity.type === 'player' || entity.type === 'animal' || entity.type === 'hostile')) return false;
                    const displayName = entity.displayName?.toString().toLowerCase();
                    const internalName = entity.name?.toLowerCase();
                    return displayName === lowerCaseTargetName || internalName === lowerCaseTargetName;
                  });
                }

        // --- THIS IS THE CRUCIAL NEW PART ---
        if (!target) {
          logError(`Could not find a mob named '${targetName}'.`);

          // Get a list of unique mob names the bot can currently see
          const nearbyMobs = Object.values(bot.entities)
            .filter(e => e.type === 'mob' && e.displayName)
            .map(e => e.displayName.toString())
            .filter((name, index, self) => self.indexOf(name) === index); // Get unique names

          if (nearbyMobs.length > 0) {
            respond(username, `I can't find a '${targetName}', but I do see: ${mobList}.`, isWhisper);
          } else {
            respond(username, `I can't find a '${targetName}'. I don't see any mobs nearby. Get closer.`, isWhisper);
          }
          continue; // Move to the next target if there are multiple
        }
        // --- END OF NEW PART ---

        logAction(`Found ${target.displayName}. Attacking!`);
        isAttacking = true; // Set flag when attack starts
        const bow = bot.inventory.findInventoryItem('bow');
        const arrows = bot.inventory.findInventoryItem('arrow'); // Check for arrows

        if (bow && arrows) { // If bot has both bow and arrows
          logAction(`Using bow to attack ${target.displayName}.`);
          bot.hawkEye.autoAttack(target, 'bow');
        } else { // No bow, or no arrows
          logAction(`No bow or no arrows found, attempting to equip best melee weapon and initiate melee attack on ${target.displayName}.`);
          const bestWeapon = getBestMeleeWeapon();
          if (bestWeapon) {
            try {
              await bot.equip(bestWeapon, 'hand');
              bot.pvp.attack(target);
            } catch (err) {
              logError(`Failed to equip ${bestWeapon.displayName}: ${err.message}`);
              logAction(`Attacking ${target.displayName} with bare hands due to equip failure.`);
              bot.pvp.attack(target);
            }
          } else {
            logAction(`No suitable melee weapon found for ${target.displayName}. Attacking with bare hands.`);
            bot.pvp.attack(target);
          }
        }
        // No immediate stop calls here, rely on event listeners
      }
      break;
    }    case 'chop': {
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
      bot.hawkEye.stop();
      break;
    case 'goto': {
      const locations = await loadLocations();
      let goal;

      if (aiCommand && typeof aiCommand.x === 'number' && typeof aiCommand.y === 'number' && typeof aiCommand.z === 'number') {
        goal = new baritoneGoals.GoalExact(new Vec3(aiCommand.x, aiCommand.y, aiCommand.z));
        logAction(`Going to AI-specified coordinates ${aiCommand.x}, ${aiCommand.y}, ${aiCommand.z}`);
      } else if (args[0] && locations[args[0]]) {
        const { x, y, z } = locations[args[0]];
        goal = new baritoneGoals.GoalExact(new Vec3(x, y, z));
        logAction(`Going to saved location "${args[0]}" at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
      } else {
        const x = parseInt(args[0]);
        const y = parseInt(args[1]);
        const z = parseInt(args[2]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>');
            return;
        }
        goal = new baritoneGoals.GoalExact(new Vec3(x, y, z));
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
      respond(username, `Health: ${bot.health.toFixed(1)}/20 | Food: ${bot.food.toFixed(1)}/20 | Saturation: ${bot.foodSaturation.toFixed(2)}`, isWhisper);
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
    default: {
      let promptForAI = message;
      // If "bloop" is used, strip it to focus the AI on the actual command.
      if (typeof message === 'string' && message.toLowerCase().startsWith('bloop')) {
        promptForAI = message.substring(5).trim(); // Remove "bloop "
      }

      // Do not send empty prompts to the AI
      if (!promptForAI) {
        break;
      }

      logAction(`Sending prompt to Ollama: "${promptForAI}"`);
      const aiResponse = await callOllama(promptForAI);

              if (aiResponse) {
                let commandObject;
                try {
                  // Basic validation: check if it looks like a JSON object
                  if (!aiResponse.startsWith('{') || !aiResponse.endsWith('}')) {
                      throw new Error('AI response is not a valid JSON object (missing curly braces).');
                  }
                  commandObject = JSON.parse(aiResponse);
                } catch (e) {
                  logError(`AI returned a non-JSON response: ${aiResponse}. Error: ${e.message}`);
                  respond(username, `I didn't understand that. The AI said: ${aiResponse}`, isWhisper);
                  break;
                }
        if (commandObject && typeof commandObject === 'object' && commandObject.command) {
          // Handle special cases from the new AI prompt
          if (commandObject.command === 'chat') {
            logAction('AI returned a chat response.');
            respond(username, commandObject.message, isWhisper);
            break;
          }
          if (commandObject.command === 'unknown') {
            logError('AI could not determine a command.');
            respond(username, "I'm not sure how to do that.", isWhisper);
            break;
          }

          logAction('AI returned a valid command. Executing...');
          // Re-run this function with the structured command.
          // We use the AI's command object directly as the 'message'.
          await handleBotMessage(username, commandObject, isWhisper);
        } else {
          logError(`AI returned invalid or incomplete JSON: ${aiResponse}`);
          respond(username, 'I received a malformed command from the AI.', isWhisper);
        }
      } else {
        logError('Ollama API call failed or returned no response. Check Ollama server and model.');
        respond(username, 'I am unable to process AI commands right now.', isWhisper);
      }
      break;
    }
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
  bot.on('health', () => {
    autoEat();
    runForSafety();
  });
  bot.on('death', async () => {
    logSystem('Bot died. Respawning...');
    try {
      await bot.respawn()
    } catch (err) {
      logError(`Error respawning: ${err.message}`)
    }
  });
  bot.on('entityHurt', async (entity) => {
    if (settings.autoDefend && entity === bot.entity) {
      // Give a small delay to allow the game state to update and attacker to be more reliably identified
      await new Promise(resolve => setTimeout(resolve, 100));

      let attacker = bot.nearestEntity((e) => {
        // Exclude self
        if (e.id === bot.entity.id) return false;

        const isHostileMob = e.type === 'mob' && e.mobType && !['Bat', 'Squid', 'Cod', 'Salmon', 'Pufferfish', 'Tropical Fish', 'Dolphin', 'Turtle', 'Strider', 'Glow Squid', 'Axolotl', 'Frog', 'Allay', 'Sniffer'].includes(e.mobType);
        const isPlayer = e.type === 'player';

        // If it's a player, chec k if they are whitelisted. If so, ignore them as an attacker.
        if (isPlayer && settings.whitelistedPlayers.includes(e.username)) {
          return false;
        }

        return (isPlayer || isHostileMob) && e.position.distanceTo(bot.entity.position) < 16; // Within 16 blocks
      });

      if (attacker && attacker.id !== bot.entity.id) { // Ensure attacker exists and is not self
        logAction(`Identified potential attacker: ${attacker.username || attacker.name || 'unknown'} (Type: ${attacker.type}, MobType: ${attacker.mobType || 'N/A'}, Distance: ${attacker.position.distanceTo(bot.entity.position).toFixed(2)})`);
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

  bot.on('itemDrop', async (entity) => {
    if (entity.type === 'item') {
      logAction(`Collecting dropped item: ${entity.displayName}`);
      try {
        await bot.collectBlock.collect(entity);
      } catch (err) {
        logError(`Could not collect item ${entity.displayName}: ${err.message}`);
      }
    }
  });
  bot.on('spawn', () => {
    logSystem('Bot spawned!')
    if (!pathfinderListenersAttached) {
      bot.ashfinder.on('goal-reach-partial', (goal) => {
        logAction('Baritone is struggling, switching to mineflayer-pathfinder for replanning.');
        bot.ashfinder.stop();
    
        let newGoal;
        if (goal instanceof baritoneGoals.GoalExact) {
            newGoal = new pathfinderGoals.GoalBlock(goal.x, goal.y, goal.z);
        } else if (goal instanceof baritoneGoals.GoalNear) {
            newGoal = new pathfinderGoals.GoalNear(goal.x, goal.y, goal.z, goal.range);
        } else {
            logError(`Cannot translate baritone goal to pathfinder goal. Goal type ${goal.constructor.name} not supported for fallback.`);
            return;
        }
        
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);
        bot.pathfinder.setGoal(newGoal, true);
      });

      bot.ashfinder.on('goal-reach', (goal) => {
        if (goal && typeof goal.x === 'number' && typeof goal.y === 'number' && typeof goal.z === 'number') {
          logAction(`Baritone goal reached: ${goal.x.toFixed(1)}, ${goal.y.toFixed(1)}, ${goal.z.toFixed(1)}`);
        } else {
          logAction('Baritone goal reached!');
        }
      });

      bot.ashfinder.on('goal-reach', () => {
        logAction('Mineflayer-pathfinder goal reached!');
      });

      pathfinderListenersAttached = true;
    }
    // Initialize prismarine-viewer only once, with port hopping
    /*if (!viewerInstance) {
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
    }*/
    bot.armorManager.equipAll()
  })

  // Add listeners to reset isAttacking flag
  bot.on('stoppedAttacking', () => {
    isAttacking = false;
    logAction('PVP attack stopped.');
  });

  // Assuming minecrafthawkeye also has a 'stoppedAttacking' event
  bot.on('stoppedAttacking', () => {
    isAttacking = false;
    logAction('HawkEye attack stopped.');
  });

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
      bot.pathfinder.setGoal(new pathfinderGoals.GoalFollow(target, 3), true)
      logAction(`Following ${name}`)
      break
    }
    case 'goto': {
      const locations = await loadLocations()
      const name = args[0]
      let goal

      if (locations[name]) {
        const { x, y, z } = locations[name]
        goal = new baritoneGoals.GoalExact(new Vec3(x, y, z))
        logAction(`Going to saved location "${name}" at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`)
      } else {
        const x = parseInt(args[0])
        const y = parseInt(args[1])
        const z = parseInt(args[2])
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            const aiResponse = await callOllama(`go to ${input}`); // Use input here
            if (aiResponse) {
                let commandObject;
                try {
                    commandObject = JSON.parse(aiResponse);
                } catch (e) {
                    logError(`AI returned a non-JSON response for goto: ${aiResponse}`);
                    logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>');
                    return;
                }
                if (commandObject && typeof commandObject === 'object' && commandObject.command === 'goto') {
                    handleBotMessage(null, commandObject); // Pass null for username as it's from terminal
                } else {
                    logError(`AI could not interpret goto command: ${input}. Response: ${aiResponse}`);
                    logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>');
                }
            } else {
                logError('Usage: goto <x> <y> <z> OR goto <saved_location_name>');
            }
            return;
        }
        goal = new baritoneGoals.GoalExact(new Vec3(x, y, z))
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
      bot.chat(`Health: ${bot.health.toFixed(1)}/20 | Food: ${bot.food.toFixed(1)}/20 | Saturation: ${bot.foodSaturation.toFixed(2)}`);
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
    case 'autoflee': {
        const arg = args[0];
        if (arg === 'on') {
            settings.autoFlee = true;
            logSystem('Auto-flee enabled.');
        } else if (arg === 'off') {
            settings.autoFlee = false;
            logSystem('Auto-flee disabled.');
        } else {
            logError('Usage: autoflee <on|off>');
        }
        await saveSettings();
        break;
    }
    case 'setfleehealth': {
        const health = parseInt(args[0]);
        if (!isNaN(health) && health > 0 && health <= 20) {
            settings.fleeHealthThreshold = health;
            logSystem(`Flee health threshold set to ${health}.`);
        } else {
            logError('Usage: setfleehealth <1-20>');
        }
        await saveSettings();
        break;
    }
    case 'setspawn': {
        const bedBlock = bot.findBlock({
            matching: block => block.name.includes('_bed'),
            maxDistance: 64
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
      const aiResponse = await callOllama(input); // Use input here
      if (aiResponse) {
        let commandObject;
        try {
          commandObject = JSON.parse(aiResponse);
        } catch (e) {
          logError(`AI returned a non-JSON response: ${aiResponse}`);
          logError(`Unknown command: ${cmd}`);
          break;
        }

        if (commandObject && typeof commandObject === 'object' && commandObject.command) {
          if (commandObject.command === 'chat') {
            logAction('AI returned a chat response.');
            logSystem(commandObject.message);
            break;
          }
          if (commandObject.command === 'unknown') {
            logError('AI could not determine a command.');
            logError(`Unknown command: ${cmd}`);
            break;
          }
          logAction('AI returned a valid command. Executing...');
          handleBotMessage(null, commandObject); // Pass null for username as it's from terminal
        } else {
          logError(`AI returned invalid or incomplete JSON: ${aiResponse}`);
          logError(`Unknown command: ${cmd}`);
        }
      } else {
        logError(`Ollama API call failed or returned no response. Unknown command: ${cmd}`);
      }
      break;
  }
});

// reconnecting...
startBot();