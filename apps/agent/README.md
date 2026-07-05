# BoatEatsBoat AI Agent

Off-chain opponent service. Joins open free duels, plays a hunt/target strategy.

## Setup

```bash
cp .env.example .env
# Fill in:
#   AGENT_PRIVATE_KEY  - the agent's wallet key (fund it with CELO for gas)
#   GAME_CONTRACT      - deployed BattleshipGame proxy address
#   CHAIN              - "celo-sepolia" (default) or "celo"
```

## Run

```bash
pnpm install
pnpm dev    # tsx, hot
# or
pnpm build && pnpm start
```

## What it does

1. Polls `nextGameId` and inspects each game every ~12s.
2. If a duel is `Open` with no wager, the agent calls `joinDuel` as player 1.
3. Once both players are in, the agent commits a randomly-generated fleet (Merkle root).
4. On its turn it fires using **hunt/target**:
   - **Hunt**: parity search (only cells where the smallest ship could start).
   - **Target**: after a hit, walks orthogonal neighbors; if two adjacent hits, extends the line.
5. When fired upon, it answers with a Merkle proof for the targeted cell (hit or miss).
6. Stops tracking the game once `Finished`.

## Notes

- The agent only joins **free** duels (wager = 0). It never stakes funds.
- The agent does not enter tournaments (entry fees) -- it is a free-play opponent.
- One agent wallet = one opponent identity. Run multiple instances with different keys
  to scale match-making throughput.
- Gas must be funded (CELO native) on the agent wallet.
