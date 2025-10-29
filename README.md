# 1BOT - Advanced Mineflayer Bot

This is a sophisticated Minecraft bot built on the Mineflayer API, designed for a high degree of automation and intelligent behavior. It leverages advanced pathfinding, combat, and resource-gathering plugins, and can interpret natural language commands using a local AI with Ollama.

## Features

-   **AI Command Interpretation (Ollama):** Can understand complex, natural language commands (e.g., "bloop hunt all hostile mobs") by sending them to a local Ollama LLM for parsing.
-   **Advanced Pathfinding:** Intelligently uses two different pathfinding engines:
    -   **Baritone (`ashfinder`):** For fast, long-distance travel, capable of breaking blocks, building bridges, and parkour.
    -   **Mineflayer-Pathfinder:** For agile, short-range, and dynamic tasks like following players or positioning for combat.
-   **Robust Combat System:**
    -   **Multi-Target Hunting:** The `hunt` command can target multiple mob types (`hunt zombie, skeleton`) or use keywords like `hunt hostile` and `hunt food`. It finds all matching targets in an area and eliminates them sequentially.
    -   **Post-Combat Looting:** After a successful hunt, the bot automatically gathers all dropped items.
    -   **Smart Auto-Defend:** When attacked, the bot immediately stops its current task to retaliate. It has a large detection radius for ranged enemies and correctly checks for both a bow and arrows before counter-attacking.
-   **Self-Sufficiency:**
    -   **Auto-Eat & Hunt:** The bot regularly checks its hunger. If it runs low on food (fewer than 15 items), it will automatically trigger the `hunt food` command to restock.
    -   **Auto-Sleep:** At night, the bot will find a nearby bed (or place one from its inventory), pathfind to it, and sleep. It then breaks and collects the bed.
-   **Continuous Resource Gathering:**
    -   **Smart Tree Chopping:** The `chop [tree_type]` command is a continuous loop. The bot finds a tree (of a specific type, if provided), chops down the *entire* tree, and then automatically moves to the next one until stopped.
    -   **Smart Ore Mining:** The `mine <ore_type>` command is a continuous loop. The bot finds the nearest exposed ore (e.g., `mine iron` finds both `iron_ore` and `deepslate_iron_ore`), mines it, collects the drop, and moves to the next ore block until stopped.
-   **General Automation:**
    -   **Auto-Reconnect:** Automatically reconnects if the connection to the server is lost.
    -   **Player Guarding:** Can be assigned to guard a player, following them and attacking any hostile mobs that approach.
    -   **Pathfinding for Item Giving:** Will walk up to a player before tossing items to them.
    -   **Automatic Armor Management:** Equips the best available armor on spawn.
-   **Utility & Debugging:**
    -   **Comprehensive Logging:** All actions, commands, and errors are saved to `saves/sys.log`.
    -   **Location Management:** Save, load, and manage named locations.
    -   **Web Inventory:** A web-based interface to view the bot's inventory (runs on an available port starting from 3000).

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd 1BOT
    ```
2.  **Install dependencies:**
    ```bash
    npm install @miner-org/mineflayer-baritone chalk dotenv minecrafthawkeye mineflayer mineflayer-armor-manager mineflayer-collectblock mineflayer-pathfinder mineflayer-pvp mineflayer-statemachine mineflayer-tool mineflayer-web-inventory prismarine-viewer node-fetch@2
    ```

## Configuration

Create a `.env` file in the project root with the following content:

```
MC_HOST=your_minecraft_server_ip
OLLAMA_HOST=http://localhost
OLLAMA_PORT=11434
OLLAMA_MODEL=gemma3:270m
```

## Usage

1.  **Start the bot:**
    ```bash
    node bot.js
    ```

## Commands

The bot responds to commands from both the in-game chat and the terminal where it's running.

-   `hunt <mob_name | hostile | food>`: Initiates a combat session to kill all specified mobs in an area, then collects the loot.
-   `mine <ore_type>`: Starts a continuous loop to find and mine a specific type of ore.
-   `chop [tree_type]`: Starts a continuous loop to find and chop down trees (optionally of a specific type).
-   `stop`: Stops all current actions, including pathfinding, combat, chopping, and mining loops.
-   `follow <player_name>`: Follows the specified player.
-   `guard <player_name>`: Follows a player and attacks hostile mobs that get near them.
-   `goto <x> <y> <z> | <location_name>`: Navigates to specific coordinates or a saved location using Baritone.
-   `save <name>`: Saves the bot's current position as a named location.
-   `list`: Displays all saved locations.
-   `delete <name>`: Deletes a saved location.
-   `status`: Displays the bot's current health, food, and saturation levels.
-   `give items to <player_name>`: Walks to a player and gives them all items from its inventory.
-   `say <message>`: Makes the bot say a message in chat.
-   `autoeat <on|off>`: Toggles the auto-eat feature.
-   `autodefend <on|off>`: Toggles the auto-defend feature.
-   `autosleep <on|off>`: Toggles the auto-sleep feature.
-   `setspawn`: Sets the bot's spawn point to the nearest bed.
-   `whitelist <add|remove> <player_name>`: Manages players who the bot will not attack.
-   `quit` or `exit`: Disconnects the bot.

## Dependencies

This project relies on several `mineflayer` plugins and other Node.js packages:

-   `mineflayer`: The core library for creating Minecraft bots.
-   `@miner-org/mineflayer-baritone`: For advanced pathfinding.
-   `mineflayer-armor-manager`: For automatic armor management.
-   `mineflayer-collectblock`: For collecting blocks.
-   `mineflayer-pathfinder`: For pathfinding capabilities.
-   `mineflayer-pvp`: For player-versus-player and player-versus-mob combat.
-   `mineflayer-tool`: For automatic tool selection.
-   `mineflayer-web-inventory`: For a web-based inventory viewer.
-   `prismarine-viewer`: To view the bot's perspective in a web browser.
-   `minecrafthawkeye`: For advanced combat targeting.
-   `dotenv`: To manage environment variables.
-   `chalk`: For colored console output.
-   `node-fetch`: For making HTTP requests (used for Ollama API).

## Contributing

Feel free to contribute to this project by submitting issues or pull requests.

## License

This project is licensed under the ISC License.
