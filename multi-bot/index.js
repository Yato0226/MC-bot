require('dotenv').config()
const mineflayer = require('mineflayer')
const { setupBotLogic, setupTerminal } = require('./bot_logic.js')

console.log('Starting multiple bots...')

// --- Bot A ---
const botA = mineflayer.createBot({
  host: process.env.MC_HOST,
  port: 25565,
  username: 'nigma',
  version: false
})

setupBotLogic(botA, 'botA');

// --- Bot B ---
const botB = mineflayer.createBot({
  host: process.env.MC_HOST,
  port: 25565,
  username: 'liger',
  version: false
})

setupBotLogic(botB, 'botB');

// --- Central Terminal ---
const bots = { botA, botB };
setupTerminal(bots);
