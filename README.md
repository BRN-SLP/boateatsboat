# BoatEatsBoat

On-chain battleship in a bathtub. Plastic ships, rubber ducks, real Celo duels.

Players commit fleet layouts as Merkle roots, fire shots, and prove every hit/miss cryptographically. The AI agent joins free duels automatically. Tournaments with cUSD escrow and Top3 split payout.

## What

Classic Battleship, reimagined as a witty bathtub arena:
- **Merkle-commit / fire / prove**: defenders answer shots with cryptographic proofs. Lying is impossible.
- **Ship classes**: Carrier (5), armored Battleship (4, hp=2), Cruiser (3), stealth Submarine (3).
- **Modes**: 1v1 duels (free or cUSD-wagered), single-elimination tournaments (Top3 split).
- **AI agent**: off-chain hunt/target opponent with its own wallet. Joins free duels within seconds.
- **Bathtub vibe**: rubber ducks, toy ships, fire-and-sink animations. Inferno (default) and Classic themes.

## Repo layout

```
apps/
  contracts/   BattleshipGame UUPS proxy + tests + deploy script
  agent/       Off-chain AI opponent (Node + viem)
  web/         Next.js 14 front end (wagmi + rainbowkit + framer-motion)
```

## Deployments

| Chain | Proxy | Impl |
|---|---|---|
| Celo mainnet (42220) | `0xa05E6B19Dd828E955331C097e8Af4DBd0c42d3f9` | `0x3727A23091A1f49601f348Cf3442b29d4ff6ba2d` |

Payment token: cUSD (`0x765DE816845861e75A25fCA122bb6898B8B1282a`).

## Local development

```bash
pnpm install

# contracts
cd apps/contracts
cp .env.example .env  # fill PRIVATE_KEY
pnpm test             # 14 hardhat tests
pnpm hardhat compile

# web
cd ../web
echo 'NEXT_PUBLIC_WC_PROJECT_ID=...' > .env.local
pnpm dev

# agent (needs a deployed contract + funded wallet)
cd ../agent
cp .env.example .env  # fill AGENT_PRIVATE_KEY + GAME_CONTRACT
pnpm dev
```

## Deploy

### Contracts

```bash
cd apps/contracts
# .env must have PRIVATE_KEY + PAYMENT_TOKEN
PAYMENT_TOKEN=0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80 \
  pnpm hardhat run scripts/deploy.ts --network celo-sepolia
```

### Web (Vercel)

1. Push this repo to GitHub.
2. Import on Vercel. Root: `/`. Build command: `pnpm build`. Output: auto (Next.js).
3. Set env vars:
   - `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect project ID from cloud.walletconnect.com)
   - `NEXT_PUBLIC_GAME_PROXY_MAINNET` is already hardcoded to the deployed proxy; override only if redeploying.
4. Deploy.

### Agent (Railway — always-on bot)

The AI opponent is a long-running Node process that listens for `BotRequested`
events, joins free duels, and plays. It must run 24/7 (it cannot live on
Netlify/Vercel, which only serve request/response functions).

1. Fund the bot wallet `0x21Fb8F9BA91864BB03F9a5ff6a8Fd648044119ae` with
   ~0.5–1 CELO on **mainnet** for gas (no gas = no moves).
2. On Railway: New Project → Deploy from GitHub → `BRN-SLP/boateatsboat`.
3. Service Settings → Root Directory: `apps/agent`.
4. Set variables (as secrets — never commit the real key):
   - `AGENT_PRIVATE_KEY` = bot wallet key
   - `GAME_CONTRACT` = `0xa05E6B19Dd828E955331C097e8Af4DBd0c42d3f9` (mainnet proxy)
   - `CHAIN` = `celo`
5. Deploy. Railway runs `pnpm build` (tsc) then `node dist/index.js`.
   See `apps/agent/railway.toml`.

## Stack

- Next.js 14 + wagmi 2 + viem 2 + rainbowkit 2
- Hardhat + @openzeppelin/hardhat-upgrades + @openzeppelin/contracts-upgradeable 5
- framer-motion, tailwind, shadcn-style components
- MiniPay auto-connect hook (scaffold-provided)
- Celo skills: celopedia, celo-rpc, celo-stablecoins, minipay-integration, fee-abstraction

## Status (2026-07-24)

- Contract: 17/17 tests, deployed Celo mainnet (UUPS proxy). Random game ids,
  requestBot (vs AI on demand), cancelDuel refund, reentrancy-hardened payouts.
- Agent: ready, tsc-clean. Event-driven discovery, joins free duels on requestBot,
  plays hunt/target, answers shots with proofs.
- Web: production build green. 5 routes (/, /play, /game/[id], /about, /leaderboard).
  Doodle-zine fullscreen UI, no-scroll, star wallet button, ship sprites w/ team colors,
  vs Friend/vs AI toggle, wager presets, claim-forfeit, sunk-ship reveal.
- Game loop verified: create duel → AI joins → both commit Merkle roots → fire/respond → victory.
- Deployed: https://boateatsboat.netlify.app (primary), https://boateatsboat.vercel.app
- Pending: mainnet deploy, Talent App registration (Proof of Ship S2).
