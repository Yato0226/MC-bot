# Minecraft Bot

A versatile Minecraft bot built with Mineflayer, featuring various functionalities for automation and interaction within the game.

## Features

-   **Player Following:** Follows specified players using `mineflayer-pathfinder`.
-   **Advanced Hunting:** Hunts players or mobs using melee (`mineflayer-pvp`) or ranged attacks (`minecrafthawkeye`) if a bow is available.
-   **Resource Collection:** Chops trees using `mineflayer-collectblock`.
-   **Advanced Pathfinding:** Uses `mineflayer-baritone` for smart navigation, including long-distance waypoint travel.
-   **Location Management:** Save, load, and manage named locations.
-   **Comprehensive Logging:** All terminal commands and console output are saved to `saves/sys.log` for debugging and review.
-   **Web Viewer:** Provides a web-based viewer for the bot's perspective using `prismarine-viewer`.
-   **Inventory Management:** Web-based inventory viewer with `mineflayer-web-inventory`.
-   **Armor Management:** Automatically equips the best available armor using `mineflayer-armor-manager`.
-   **Custom Logging:** Custom, colored console logging for better readability.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd 1BOT
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

Create a `.env` file in the project root with the following content:

```
MC_HOST=your_minecraft_server_ip
```

## Usage

1.  **Start the bot:**
    ```bash
    node bot.js
    ```
2.  **Access the viewer:** Open your web browser to `http://localhost:3007` to see the bot's perspective.
3.  **Access the web inventory:** The web inventory will be available on a different port, which will be printed to the console when the bot starts.

## Commands

### In-Game Chat Commands

The bot responds to the following chat commands in-game:

-   `hi bot`: The bot will greet you.
-   `follow <player_name>`: The bot will follow the specified player.
-   `hunt <name>` or `kill <name>`: Hunts the specified player or mob. Uses a bow for ranged attacks if available, otherwise uses melee.
-   `chop`: The bot will find and chop the nearest tree.
-   `stop`: Stops all current actions (pathfinding, PVP, etc.).

### Terminal Commands

Interact with the bot directly from the terminal where it's running:

-   `say <message>`: Makes the bot say `<message>` in-game chat.
-   `follow <player_name>`: The bot will follow the specified player.
-   `chop`: The bot will find and chop the nearest tree.
-   `stop`: Stops all current actions (pathfinding, PVP, etc.).
-   `status`: Displays the bot's current health, food, and saturation levels.
-   `quit` or `exit`: Disconnects the bot and closes the terminal interface.

### Location Management Commands

-   `save <name>`: Saves the bot's current position as a named location.
-   `goto <name>` or `goto <x> <y> <z>`: Navigates to a saved location by name or to the specified coordinates.
-   `list`: Displays all saved locations.
-   `delete <name>`: Deletes a saved location.

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

## Contributing

Feel free to contribute to this project by submitting issues or pull requests.

## License

This project is licensed under the ISC License.