# Simultaneous Omok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable real-time 2–6 player simultaneous Omok web game.

**Architecture:** React/Vite renders the board and room UI. A Node/Express/Socket.IO server owns all room state and resolves initial placements, timed simultaneous selections, collisions, and wins.

**Tech Stack:** TypeScript, React, Vite, Node.js, Express, Socket.IO, Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-simultaneous-omok-design.md`

## Global Constraints
- Board is 15x15.
- Rooms accept 2–6 players.
- Initial phase uses exactly 3 sequential stones per player.
- Main round planning time is 15 seconds.
- Main round allows up to 5 private selections per player.
- Colliding coordinates receive no stone.
- Five or more contiguous stones wins; joint winners are allowed.

---

### Task 1: Pure game engine
- [ ] Write failing tests for placement validation, collision resolution, and win detection.
- [ ] Run tests and verify failure.
- [ ] Implement pure game engine functions.
- [ ] Run tests and verify pass.

### Task 2: Room state machine
- [ ] Write failing tests for 2–6 player join limits, initial order/placements, ready state, round resolution, and 15-second deadline metadata.
- [ ] Run tests and verify failure.
- [ ] Implement room state machine.
- [ ] Run tests and verify pass.

### Task 3: Socket.IO server
- [ ] Implement room creation/join/reconnect/start/initial-place/select/ready events.
- [ ] Keep unrevealed selections private.
- [ ] Broadcast authoritative snapshots and round resolution events.
- [ ] Verify server TypeScript build.

### Task 4: React web client
- [ ] Implement home/create/join flow.
- [ ] Implement lobby for 2–6 players.
- [ ] Implement sequential initial placement UI.
- [ ] Implement 15-second selection UI with up to 5 private ghost stones.
- [ ] Implement ready, reveal/collision feedback, game-over and rematch UI.
- [ ] Verify Vite production build.

### Task 5: Documentation and packaging
- [ ] Add README with local run instructions and rules.
- [ ] Add environment example.
- [ ] Run tests and build.
- [ ] Zip the project for handoff.
