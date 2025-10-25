# minecraftHawkEye
Module for the Minecraft bot, hit 100% of the time with the bow, using the equations of parabolic shooting with friction

This module is based on bot of <a href="https://github.com/PrismarineJS/mineflayer" target="_blank">mineflayer</a> repository

This calculate the trajectory of arrow / snowballs... to ensure which is the best angle to hit,

They can hit from 120 blocks away!

Install:
- Install nodejs >= 14 from nodejs.org
- npm i minecrafthawkeye

Usage: 

First load mineflayer and minecrafthawkeye, and load plugin into mineflayer
```js
const mineflayer = require('mineflayer')
const minecraftHawkEye = require('minecrafthawkeye');
bot.loadPlugin(minecraftHawkEye)
const weapon = 'bow'
```

Now you can request functions
```js
// Get an a entity
// Example get te player entity, If emtpy return first player found
const playerEntity = bot.hawkEye.getPlayer(playername) 

// Auto attack every 1,2 secs to target
bot.hawkEye.autoAttack(target, weapon)

// Stop auto attack
bot.hawkEye.stop()

// Fire only 1 shot
bot.hawkEye.oneshot(target, weapon)

// Otherwise you can get Yaw and Pitch
bot.hawkEye.getMasterGrade(target, speedInVec3, weapon)
// With Yaw and Pitch you can use yourself bot.look(yaw,pitch) adn activate / deactivate main hand to fire


// Similar has oneshot but need yo add manually the Pitch and Way in radians
bot.hawkEye.simplyShot(yaw, pitch)

// If you want the result of calculation of arrow trajectory you can use that
bot.hawkEye.calculateArrowTrayectory(currentPosition, currentSpeed, pitch, yaw, 'bow')

// Start to check if any player / mob or any incoming to bot
// CAUTION: This use a lot of CPU, because on each tick game calculate all nearby mobs or players
bot.hawkEye.startRadar()
bot.hawkEye.stopRadar()

// Return a array of mobs & players are looking in your direction
bot.hawkEye.detectAim()

// Return list of arrows are in "air" just now
bot.hawkEye.detectProjectiles()


```

A example in one file:

```js
// ** Grant OP to Archer **
// file: example.js
const mineflayer = require('mineflayer')
const minecraftHawkEye = require('minecrafthawkeye');
const Vec3 = require('Vec3')

const bot = mineflayer.createBot({
    host: process.argv[2] ? process.argv[2] : 'localhost',
    port: process.argv[3] ? parseInt(process.argv[3]) : 25565,
    username: process.argv[4] ? process.argv[4] : 'Archer',
    password: process.argv[5]
})

bot.loadPlugin(minecraftHawkEye)

bot.on('spawn', function() {
    bot.chat('/give ' + bot.username + ' bow{Enchantments:[{id:unbreaking,lvl:3}]} 1')
    bot.chat('/give ' + bot.username + ' minecraft:arrow 300')
    bot.chat('/time set day')
    bot.chat('/kill @e[type=minecraft:arrow]')
    bot.chat('Ready!')

    // Get target for block position, use whatever you need
    const target = bot.hawkEye.getPlayer()
    console.log(target)
    if (!target) {
        return false
    }

    weapon = 'bow'
    // Auto attack every 1,2 secs until target is dead or is to far away
    bot.hawkEye.autoAttack(target, weapon)
        // If you force stop attack use:
        // hawkEye.stop();

    // Use one shot time with calc:
    // bot.hawkEye.oneShot(target);

    // If you want to shot in XYZ position:
    /*
          const blockPosition = {
                  position: new Vec3(244.5, 75.5, -220),
                  isValid: true
              }
          // bot.hawkEye.oneShot(blockPosition);
          // bot.hawkEye.autoAttack(blockPosition);
      */
})
```
All is done, when is attack mode they get best possibility for impact, and shot arrow every 1,2 secs (max power)

## Valid list of weapons or items that can calculate the perfect shot or launch it directly
```
bow
crossbow
snowball
ender_pearl
egg
splash_potion
trident
```

Events:

When but uses autoAttack and the mob is gone (killed o dissapeared)
```ts
bot.on('auto_shot_stopped', (target: Entity | OptionsMasterGrade) => {
    ///
})
```
When radar is active and some player or mob are aim you dispatch this event
```ts
bot.on('target_aiming_at_you', (entity: Entity, arrowTrajectory: Array<Vec3>) => {
    ///
})
```
When radar is active and When arrow are incoming and can be hit bot this event is dispatched
```ts
bot.on('incoming_projectil', (projectil: Projectil, arrowTrajectory: Array<Vec3>) => {
    ///
})
```

I'm glad I can help you, do we help each other?

## Videos:
https://www.youtube.com/watch?v=InMkncDnYTA

https://www.youtube.com/watch?v=jjl4mMyL7hk

https://www.youtube.com/watch?v=OHX3u8Nrrp8

https://www.youtube.com/watch?v=VKg5xiww5Lo

## TODOs
No TODOs!
Anyone have more ideas? :D

# mineflayer-pvp <!-- omit in toc -->

Welcome to the *mineflayer-pvp* API documentation page.

## Table of Contents <!-- omit in toc -->

- [1. Summary](#1-summary)

## 1. Summary

* `bot.pvp.attack(entity)`

  Attacks the given entity

* `bot.pvp.target`

  The entity currently being attacked, if any. Value is read-only!

* `bot.pvp.stop()`

  Stops attacking the target entity.

* `bot.pvp.forceStop()`

  Stops attacking the target entity. Forces pathfinder to stop.

* `bot.pvp.movements`

  The pathfinder movements config to use when pursuing a target.

* `bot.pvp.followRange`

  How close to try to get to the target.

* `bot.pvp.viewDistance`

  How far away should a target be before losing interest.

* `bot.pvp.attackRange`

  How far from the target can the bot be and still try to attack.

* `bot.pvp.meleeAttackRate`

  The solver for determining how often to attack the target.

* `bot.on('startedAttacking', () => {})`

  Called when the bot has started attacking a new target.

* `bot.on('stoppedAttacking', () => {})`

  Called when the bot has stopped attacking a target. (Either manualluy stopped, or target has died/teleported/despawned/disconnected.)

* `bot.on('attackedTarget', () => {})`

  Called each time the bot preforms a melee attack.

  # Mineflayer-Tool <!-- omit in toc -->

Welcome to the *Mineflayer-Tool* API documentation page.

## Table of Contents <!-- omit in toc -->

- [1. Summary](#1-summary)

## 1. Summary

* `bot.tool.equipForBlock(block: Block, options?: MiningEquipOptions, cb?: (err?: Error) => void): Promise<void>`
  
  Can be used to instruct the bot to equip the best tool for mining the target block. Tools that are faster are considered better.

  Options:

  * `requireHarvest: boolean`

    If true, only tools that can harvest the item are considered. (I.e. requires iron pickaxe to mine diamond ore) If bot does not have a tool in it's inventory that can harvest the target block, an error is thrown.

    # Mineflayer-pathfinder

[![npm version](https://badge.fury.io/js/mineflayer-pathfinder.svg)](https://badge.fury.io/js/mineflayer-pathfinder) ![npm](https://img.shields.io/npm/dt/mineflayer-pathfinder) [![Try it on gitpod](https://img.shields.io/badge/try-on%20gitpod-brightgreen.svg)](https://gitpod.io/#https://github.com/PrismarineJS/mineflayer-pathfinder) [![Issue Hunt](https://github.com/BoostIO/issuehunt-materials/blob/master/v1/issuehunt-shield-v1.svg)](https://issuehunt.io/r/PrismarineJS/mineflayer-pathfinder)

Pathfinding plugin for the Minecraft Bot API [Mineflayer](https://github.com/PrismarineJS/mineflayer). Create static, dynamic or composite goals to navigate Minecraft terrain fully autonomously.

Mostly stable. Feel free to contribute by making suggestions or posting issues.

## Install

```bash
npm install mineflayer-pathfinder
```

## Tutorial & Explanation

For a basic explanation of how to use mineflayer-pathfinder, you can read [this tutorial](./examples/tutorial/goalsExplained.md).

## Video Tutorials

For a video tutorial explaining the usage of mineflayer-pathfinder, you can watch the following Youtube videos:

[<img src="https://img.youtube.com/vi/UWGSf08wQSc/0.jpg" alt="part 1" width="200">](https://www.youtube.com/watch?v=UWGSf08wQSc)
[<img src="https://img.youtube.com/vi/ssWE0kXDGJE/0.jpg" alt="part 2" width="200">](https://www.youtube.com/watch?v=ssWE0kXDGJE)

## Example

```js
const mineflayer = require('mineflayer')
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const { GoalNear } = require('mineflayer-pathfinder').goals
const bot = mineflayer.createBot({ username: 'Player' })

bot.loadPlugin(pathfinder)

bot.once('spawn', () => {
  const defaultMove = new Movements(bot)
  
  bot.on('chat', function(username, message) {
  
    if (username === bot.username) return

    const target = bot.players[username] ? bot.players[username].entity : null
    if (message === 'come') {
      if (!target) {
        bot.chat('I don\'t see you !')
        return
      }
      const p = target.position

      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))
    } 
  })
})
```

## Features
 * Optimized and modernized A* pathfinding
 * Complexe goals can be specified (inspired by [baritone goals](https://github.com/cabaletta/baritone/blob/master/FEATURES.md#goals) )
 * Customizable movements generator
 * Each movement can have a different cost
 * Can break/place blocks as part of its deplacement
 * Automatically update path when environment change
 * Long distance paths
 * Can swim
 * Can avoid entities
 * Modular and easily extendable with different behavior

## API
Considering there are a lot of deep changes that are being worked on, it could take some time before it's done

Also, **for now**, there is only the `pathfinder` module, `movements` and `goals` still need to be done


## Functions:

### bot.pathfinder.goto(goal)
Returns a Promise with the path result. Resolves when the goal is reached. Rejects on error.
 * `goal` - Goal instance

### bot.pathfinder.bestHarvestTool(block)
Returns the best harvesting tool in the inventory for the specified block.
 * `Returns` - `Item` instance or `null`
 * `block` - Block instance

### bot.pathfinder.getPathTo(movements, goal, timeout)
 * `Returns` - The path
 * `movements` - Movements instance
 * `goal` - Goal instance
 * `timeout` - number (optional, default `bot.pathfinder.thinkTimeout`)

### bot.pathfinder.getPathFromTo* (movements, startPos, goal, options = {})
Returns a Generator. The generator computes the path for as longs as no full path is found or `options.timeout` is reached. 
The generator will block the event loop until a path is found or `options.tickTimeout` (default to 50ms) is reached.
 * `Returns` - A generator instance. See [MDN function*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*).
 * `movements` - Movements instance
 * `startPos` - A Vec3 instance. The starting position to base the path search from. 
 * `goal` - Goal instance
 * `options` - A optional options object contains:
   * `optimizePath` - Boolean Optional. Optimize path for shortcuts like going to the next node in a strait line instead walking only diagonal or along axis.
   * `resetEntityIntersects` - Boolean Optional. Reset the `entityIntersections` index for `movements`. Default: true
   * `timeout` - Number Optional. Total computation timeout.
   * `tickTimeout` - Number Optional. Maximum amount off time before yielding.
   * `searchRadius` - Number Optional. Max distance to search.
   * `startMove` - instance of Move Optional. A optional starting position as a Move. Replaces `startPos` as the starting position.

### bot.pathfinder.setGoal(Goal, dynamic)
 * `goal` - Goal instance
 * `dynamic` - boolean (optional, default false)
 
### bot.pathfinder.setMovements(movements)
Assigns the movements config.
 * `movements` - Movements instance

### bot.pathfinder.stop()
Stops pathfinding as soon as the bot has reached the next node in the path (this prevents the bot from stopping mid-air). Emits `path_stop` when called.
Note: to force stop immediately, use `bot.pathfinder.setGoal(null)`

### bot.pathfinder.isMoving()
A function that checks if the bot is currently moving.
 * `Returns` - boolean

### bot.pathfinder.isMining()
A function that checks if the bot is currently mining blocks.
 * `Returns` - boolean

### bot.pathfinder.isBuilding()
A function that checks if the bot is currently placing blocks.
 * `Returns` - boolean

# Properties:
### bot.pathfinder.thinkTimeout
Think Timeout in milliseconds.
 * `Default` - `5000`

### bot.pathfinder.tickTimeout
How many milliseconds per tick are allocated to thinking.
 * `Default` - `40`

### bot.pathfinder.searchRadius
The search limiting radius, in blocks, if `-1` the search is not limited by distance.
 * `Default` - `-1`

## Movement class
This class configures how pathfinder plans its paths. It configures things like block breaking or different costs for moves. This class can be extended to add or change how pathfinder calculates its moves.

## Usage
Pathfinder instantiates the default movement class by itself if no instance is specified. If you want to change values you should create a new instance of the Movements class, change it's values and set it as pathfinders new movement class. 
### Example:
```js
const { Movements } = require('mineflayer-pathfinder') // Import the Movements class from pathfinder

bot.once('spawn', () => {
  // A new movement instance for specific behavior
  const defaultMove = new Movements(bot)

  defaultMove.allow1by1towers = false // Do not build 1x1 towers when going up
  defaultMove.canDig = false // Disable breaking of blocks when pathing 
  defaultMove.scafoldingBlocks.push(bot.registry.itemsByName['netherrack'].id) // Add nether rack to allowed scaffolding items
  bot.pathfinder.setMovements(defaultMove) // Update the movement instance pathfinder uses

  // Do pathfinder things
  // ...
})
```

## Movements class default properties
Movement class properties and their default values.
### canDig
Boolean to allow breaking blocks.
* Default `true`

### digCost
Additional cost for breaking blocks.
* Default - `1`

### placeCost
Additional cost for placing blocks.
* Default - `1`

### maxDropDown
Max drop down distance. Only considers drops that have blocks to land on.
* Default - `4`

### infiniteLiquidDropdownDistance
Option to ignore maxDropDown distance when the landing position is in water.
* Default - `true`

### liquidCost
Additional cost for interacting with liquids.
* Default - `1`

### entityCost
Additional cost for moving through an entity hitbox (besides passable ones).
* Default - `1`

### dontCreateFlow
Do not break blocks that touch liquid blocks.
* Default - `true`

### dontMineUnderFallingBlock
Do not break blocks that have a gravityBlock above.
* Default - `true`

### allow1by1towers
Allow pillaring up on 1x1 towers.
* Default - `true`

### allowFreeMotion
Allow to walk to the next node/goal in a straight line if terrain allows it.
* Default - `false`

### allowParkour
Allow parkour jumps like jumps over gaps bigger then 1 block.
* Default - `true`

### allowSprinting
Allow sprinting when moving.
* Default - `true`

### allowEntityDetection
Test for entities that may obstruct path or prevent block placement. Grabs updated entities every new path.
* Default - `true`

### entitiesToAvoid
Set of entities (by bot.registry name) to completely avoid when using entity detection.
* instance of `Set`

### passableEntities
Set of entities (by bot.registry name) to ignore when using entity detection.
* instance of `Set`
* Default - See lib/passableEntities.json

### interactableBlocks
Set of blocks (by bot.registry name) that pathfinder should not attempt to place blocks or 'right click' on.
* instance of `Set`
* Default - See lib/interactable.json

### blocksCantBreak
Set of block id's pathfinder cannot break. Includes chests and all unbreakable blocks.
* instance of `Set`

### blocksToAvoid
Set of block id's to avoid.
* instance of `Set`

### liquids
Set of liquid block id's.
* instance of `Set`

### climbables
Set of block id's that are climable. Note: Currently unused as pathfinder cannot use climables.
* instance of `Set`

### replaceables
Set of block id's that can be replaced when placing blocks.
* instance of `Set`

### scafoldingBlocks
Array of item id's that can be used as scaffolding blocks.
* Default - `[<scaffoldingItems>]`

### gravityBlocks
Set of block id's that can fall on bot's head.
* instance of `Set`

### fences
Set of block id's that are fences or blocks that have a collision box taller then 1 block.
* instance of `Set`

### carpets
Set of all carpet block id's or blocks that have a collision box smaller then 0.1. These blocks are considered safe to walk in.
* instance of `Set`

### exclusionAreasStep
An array of functions that define an area or block to be step on excluded. Every function in the array is parsed the Block the bot is planing to step on. Each function should return a positive number (includes 0) that defines extra cost for that specific Block. 0 means no extra cost, 100 means it is impossible for pathfinder to consider this move.
* Array of functions `(block: Block) => number`

### exclusionAreasBreak
An array of functions that define an area or block to be break excluded. Every function in the array is parsed the Block the bot is planing to break. Each function should return a positive number (includes 0) that defines extra cost for that specific Block. 0 means no extra cost, 100 means it is impossible for pathfinder to consider this move.
* Array of functions `(block: Block) => number`

### exclusionAreasPlace
An array of functions that define an area to be block placement excluded. Every function in the array is parsed the current Block the bot is planing to place a block inside (should be air or a replaceable block most of the time). Each function should return a positive number (includes 0) that defines extra cost for that specific Block. 0 means no extra cost, 100 makes it impossible for pathfinder to consider this move.
* Array of functions `(block: Block) => number`

### entityIntersections
A dictionary of the number of entities intersecting each floored block coordinate. Updated automatically for each path, but you may mix in your own entries before calculating a path if desired (generally for testing). To prevent this from being cleared automatically before generating a path,s see the [path gen options](#botpathfindergetpathfromto-movements-startpos-goal-options--). 
* Formatted entityIntersections['x,y,z'] = #ents
* Dictionary of costs `{string: number}`

### canOpenDoors
Enable feature to open Fence Gates. Unreliable and known to be buggy.
* Default - `false`

## Events:

### goal_reached
Called when the goal has been reached. Not called for dynamic goals.

### path_update
Called whenever the path is recalculated. Status may be:
 * `success` a path has been found
 * `partial` a partial path has been found, computations will continue next tick
 * `timeout` timed out
 * `noPath` no path was found

### goal_updated
Called whenever a new goal is assigned to the pathfinder.

### path_reset
Called when the path is reset, with a reason:
 * `goal_updated`
 * `movements_updated`
 * `block_updated`
 * `chunk_loaded`
 * `goal_moved`
 * `dig_error`
 * `no_scaffolding_blocks`
 * `place_error`
 * `stuck`

 ### path_stop
 Called when the pathing has been stopped by `bot.pathfinder.stop()`

## Goals:

### Goal
Abstract Goal class. Do not instantiate this class. Instead extend it to make a new Goal class.

Has abstract methods:
 - `heuristic(node)`
   * `node` - A path node
   * Returns a heuristic number value for a given node. Must be admissible – meaning that it never overestimates the actual cost to get to the goal.
 - `isEnd(node)`
   * `node`
   * Returns a boolean value if the given node is a end node. 

Implements default methods for:
 - `isValid()`
   * Always returns `true`
 - `hasChanged(node)`
   * `node` - A path node
   * Always returns `false`

### GoalBlock(x, y, z)
One specific block that the player should stand inside at foot level
 * `x` - Integer
 * `y` - Integer
 * `z` - Integer

### GoalNear(x, y, z, range)
A block position that the player should get within a certain radius of
 * `x` - Integer
 * `y` - Integer
 * `z` - Integer
 * `range` - Integer
 
### GoalXZ(x, z)
Useful for long-range goals that don't have a specific Y level
 * `x` - Integer
 * `z` - Integer

### GoalNearXZ(x, z, range)
Useful for finding builds that you don't have an exact Y level for, just an approximate X and Z level.
 * `x` - Integer
 * `z` - Integer
 * `range` - Integer

### GoalY(y)
Get to a Y level.
 * `y` - Integer


### GoalGetToBlock(x, y, z)
Don't get into the block, but get directly adjacent to it. Useful for chests.
 * `x` - Integer
 * `y` - Integer
 * `z` - Integer

### GoalCompositeAny(Array\<Goal>?)
A composite of many goals, any one of which satisfies the composite.
For example, a GoalCompositeAny of block goals for every oak log in loaded
chunks would result in it pathing to the easiest oak log to get to.
 * `Array` - Array of goals

### GoalCompositeAll(Array\<Goal>?)
A composite of multiple goals, requiring all of them to be satisfied.
 * `Array` - Array of goals

### GoalInvert(goal)
Inverts the goal.
 * `goal` - Goal to invert

### GoalFollow(entity, range)
Follows an entity.
 * `entity` - Entity instance
 * `range` - Integer

### GoalPlaceBlock(pos, world, options)
Position the bot in order to place a block.
 * `pos` - Vec3 the position of the placed block
 * `world` - the world of the bot (Can be accessed with `bot.world`)
 * `options` - object containing all optionals properties:
   * `range` - maximum distance from the clicked face
   * `faces` - the directions of the faces the player can click
   * `facing` - the direction the player must be facing
   * `facing3D` - boolean, facing is 3D (true) or 2D (false)
   * `half` - `top` or `bottom`, the half that must be clicked

 ### GoalLookAtBlock(pos, world, options = {})
 Path into a position were a blockface of block at pos is visible. Fourth argument is optional and contains extra options.
  * `pos` - Vec3 the block position to look at
  * `world` - the world of the bot (Can be accessed with `bot.world`)
  * `options` - object containing all optionals properties:
    * `reach` - number maximum distance from the clicked face. Default `4.5`
    * `entityHeight` - number Default is `1.6`

 ### GoalBreakBlock(x, y, z, bot, options)
 Deprecated. Wrapper for GoalLookAtBlock. Use GoalLookAtBlock instead.

 # ArmorManager

Plugin for [MineFlayer](https://github.com/PrismarineJS/mineflayer), that makes bot automatically equip better armor.

![Footage](/footage.gif)

## Getting started

If using **NPM**:

`npm install mineflayer-armor-manager`

If using **YARN**:

`yarn add mineflayer-armor-manager`

## Usage

```js
const armorManager = require("mineflayer-armor-manager");
const mineflayer = require("mineflayer");

const bot = mineflayer.createBot({
  username: "Player",
  host: "localhost",
  port: 25565,
});

bot.loadPlugin(armorManager);
```

If needed, it's possible to trigger a function that will check whole inventory and equip best possible armor, on spawn for example:

```js
bot.once("spawn", () => bot.armorManager.equipAll());
```

## License

MIT © [Konstantin Azizov](https://github.com/G07cha/)

# mineflayer-collectblock <!-- omit in toc -->

Welcome to the *mineflayer-collectblock* API documentation page.

## Table of Contents <!-- omit in toc -->

- [1. Summary](#1-summary)
- [Properties](#properties)
  - [`bot.collectblock.movements: Movements`](#botcollectblockmovements-movements)
- [Functions](#functions)
  - [collect](#collect)
    - [Options:](#options)

## 1. Summary

The collect block plugin is a utility plugin that can be used to help make collecting blocks and item drops very easy, using only a single API call. No need to worry about pathfinding to the block, selecting the right tool, or moving to pick up the item drop after mining.

## Properties

### `bot.collectblock.movements: Movements`

The movements object used by the pathfinder plugin to define the movement configuration. This object is passed to the pathfinder plugin when any API from this plugin is called in order to control how pathfinding should work when collecting the given blocks or item.

If set to null, the pathfinder plugin movements is not updated.

Defaults to a new movements object instance.

## Functions

### collect

Usage: `bot.collectblock.collect(target: Collectable | Collectable[], options?: CollectOptions, cb: (err?: Error) => void): void`

Causes the bot to collect the given block, item drop, or list of those. If the target is a block, the bot will move to the block, mine it, and pick up the item drop. If the target is an item drop, the bot will move to the item drop and pick it up. If the target is a list of collectables, the bot will move from target to target in order of closest to furthest and collect each target in turn.

#### Options:

  * `append: boolean`

    If true, the target(s) will be appended to the existing target list instead of starting a new task. Defaults to false.

  * `ignoreNoPath: boolean`

    If true, errors will not be thrown when a path to the target block cannot be found. The bot will attempt to choose the best available position it can find, instead. Errors are still thrown if the bot cannot interact with the block from it's final location. Defaults to false.

  * `chestLocations: Vec3[]`

    Gets the list of chest locations to use when storing items after the bot's inventory becomes full. If undefined, it defaults to the chest location list on the bot.collectBlock plugin.

  * `itemFilter: ItemFilter`

    When transferring items to a chest, this filter is used to determine what items are allowed to be moved, and what items aren't allowed to be moved. Defaults to the item filter specified on the bot.collectBlock plugin.