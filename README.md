# Minecraft Bot

A versatile Minecraft bot built with Mineflayer, featuring various functionalities for automation and interaction within the game.

## Features

-   **Player Following:** Follows specified players using `mineflayer-pathfinder`.
-   **Mob Hunting:** Hunts and attacks specified mobs using `mineflayer-pvp`.
-   **Resource Collection:** Chops trees using `mineflayer-collectblock`.
-   **Combat Assistance:** Utilizes `minecrafthawkeye` for advanced attacking capabilities.
-   **State Machine Support:** Integrated with `mineflayer-statemachine` for complex behavior trees (currently loaded, but no state machines implemented).
-   **Visualization:** Provides a web-based viewer for the bot's perspective using `mineflayer-viewer`.
-   **Inventory Management:** Web-based inventory viewer with `mineflayer-web-inventory`.
-   **Lightweight Terminal Interface:** Custom console for logs, chat, and bot control.
-   **Armor Management:** Automatically equips the best available armor using `mineflayer-armor-manager`.
-   **Baritone Integration:** Loaded `mineflayer-baritone` plugin for advanced pathfinding (commands not yet implemented).

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
3.  **Install mineflayer-statemachine (if not already installed):**
    ```bash
    npm install --save mineflayer-statemachine
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
3.  **Access the web inventory:** The web inventory will be available on a different port, usually `http://localhost:5000` (check console for exact port).

## Commands

### In-Game Chat Commands

The bot responds to the following chat commands in-game:

-   `follow <player_name>`: The bot will follow the specified player.
-   `hunt <mob_name>`: The bot will hunt and attack the specified mob.
-   `chop`: The bot will find and chop the nearest tree.
-   `stop`: Stops all current actions (pathfinding, PVP, etc.).

### Terminal Commands

Interact with the bot directly from the terminal where it's running:

-   `say <message>`: Makes the bot say `<message>` in-game chat.
-   `follow <player_name>`: The bot will follow the specified player.
-   `chop`: The bot will find and chop the nearest tree.
-   `stop`: Stops all current actions (pathfinding, PVP, etc.).
-   `quit` or `exit`: Disconnects the bot and closes the terminal interface.

## Contributing

Feel free to contribute to this project by submitting issues or pull requests.

## License

This project is licensed under the MIT License.