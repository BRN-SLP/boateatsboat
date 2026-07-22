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
| Celo Sepolia (11142220) | `0x1c8780b202af9917ba8CaeD65202ffD2013d2205` | `0x03167BC276B80A082547F4Ab3Ca03C05FE8B9c9E` |
| Celo mainnet (42220) | _not deployed yet_ | _not deployed yet_ |

Payment token: USDm on Sepolia (`0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80`), cUSD on mainnet (`0x765DE816845861e75A25fCA122bb6898B8B1282a`).

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
   - `NEXT_PUBLIC_GAME_PROXY_SEPOLIA=0x1c8780b202af9917ba8CaeD65202ffD2013d2205` (already default)
   - `NEXT_PUBLIC_GAME_PROXY_MAINNET` (when mainnet deploys)
4. Deploy.

## Stack

- Next.js 14 + wagmi 2 + viem 2 + rainbowkit 2
- Hardhat + @openzeppelin/hardhat-upgrades + @openzeppelin/contracts-upgradeable 5
- framer-motion, tailwind, shadcn-style components
- MiniPay auto-connect hook (scaffold-provided)
- Celo skills: celopedia, celo-rpc, celo-stablecoins, minipay-integration, fee-abstraction

## Status (2026-07-23)

- Contract: 14/14 tests, deployed Celo Sepolia (UUPS proxy).
- Agent: ready, tsc-clean. Joins free duels, plays hunt/target, answers shots with proofs.
- Web: production build green. 5 routes (/, /play, /game/[id], /about, /leaderboard).
  Doodle-zine fullscreen UI, no-scroll, star wallet button, ship sprites w/ team colors.
- Game loop verified: create duel → AI joins → both commit Merkle roots → fire/respond → victory.
- Deployed: https://boateatsboat.vercel.app
- Pending: mainnet deploy after final review, Talent App registration (Proof of Ship S2).
