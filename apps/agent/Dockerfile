# Dockerfile for the BoatEatsBoat AI agent.
# Railway uses this directly when present (Nixpacks steps aside), giving full
# control over the Node version, pnpm install, and PATH across layers.
#
# Railway service Settings -> Root Directory must be: apps/agent

FROM node:20-slim

# Enable pnpm via corepack, but bypass the signature check that breaks on
# older corepack builds (Cannot find matching keyid). Pin to the repo's version.
ENV COREPACK_INTEGRITY_KEYS=none
RUN corepack enable && corepack prepare pnpm@8.10.0 --activate

WORKDIR /app

# Copy the whole monorepo (lockfile + workspace manifests needed by pnpm).
COPY . .

# Install the agent workspace + its deps (resolves viem etc. from the lockfile).
RUN pnpm install --frozen-lockfile --filter @boateatsboat/agent...

# Build the agent (tsc -> dist/).
RUN pnpm --filter @boateatsboat/agent build

# Railway injects AGENT_PRIVATE_KEY, GAME_CONTRACT, CHAIN as env vars at runtime.
CMD ["node", "dist/index.js"]
