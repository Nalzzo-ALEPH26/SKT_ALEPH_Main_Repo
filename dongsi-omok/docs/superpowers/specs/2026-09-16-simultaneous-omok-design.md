# Simultaneous Omok Design

## Goal
Build a browser-based real-time 2–6 player Omok variant.

## Rules
- Board: 15x15.
- Players: 2–6.
- Initial phase: random player order; each player, one at a time, places exactly 3 stones on empty cells.
- Main rounds: each player has 15 seconds to privately choose up to 5 empty cells.
- Players may ready early. When all active players are ready or the deadline expires, selections lock.
- A coordinate selected by 2 or more players is a collision and receives no stone.
- Non-colliding selections are placed simultaneously.
- After resolution, any player with 5 or more contiguous stones horizontally, vertically, or diagonally wins.
- Multiple winners in the same resolution are joint winners.
- New players can join only while the room is in LOBBY and fewer than 6 players are present.
- Reconnects by an existing player are allowed during a game.
- Spectators are out of scope for MVP.

## Architecture
- React + TypeScript + Vite client.
- Node.js + TypeScript + Express + Socket.IO server.
- Server-authoritative room, timer, selection, collision, board, and win state.
- In-memory room state for MVP.
- One package with client and server directories for simple local setup.
