require('dotenv').config()
const mineflayer = require('mineflayer')
const baritone = require('@miner-org/mineflayer-baritone').loader
const readline = require('readline')

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

bot.loadPlugin(baritone)

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

    if (target) {
      bot.chat(`Following ${targetName}`)
      bot.baritone.follow(target)
    } else {
      bot.chat(`Could not find ${targetName}`)
    }
  } else if (message.startsWith('hunt ')) {
    const targetName = message.substring('hunt '.length)
    const target = bot.entities.find(e => e.name === targetName && e.type === 'mob')

    if (target) {
      bot.chat(`Hunting ${targetName}`)
      bot.baritone.follow(target)

      const attackInterval = setInterval(() => {
        const distance = bot.entity.position.distanceTo(target.position)
        if (distance < 3) { // Attack when close enough
          bot.attack(target)
        }
        if (target.isValid === false) { // Stop hunting if target is dead
          clearInterval(attackInterval)
          bot.chat(`Finished hunting ${targetName}`)
          bot.baritone.stop()
        }
      }, 1000) // Check every second
    } else {
      bot.chat(`Could not find mob ${targetName}`)
    }
  } else if (message === 'stop') {
    bot.chat('Stopping current action.')
    bot.baritone.stop()
  }
})

bot.on('error', err => console.log(err))
bot.on('end', () => console.log('Disconnected'))
