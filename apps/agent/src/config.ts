import { createWalletClient, createPublicClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoSepolia, celo } from "viem/chains";

/**
 * Agent configuration. Reads from env:
 *  AGENT_PRIVATE_KEY   - the AI opponent's wallet key (its identity + signer)
 *  GAME_CONTRACT       - deployed BattleshipGame proxy address
 *  RPC_URL             - override the default Forno endpoint
 *  CHAIN               - "celo" (mainnet, default) or "celo-sepolia"
 */

export const CHAIN = (process.env.CHAIN ?? "celo-sepolia") === "celo" ? celo : celoSepolia;

export const RPC_URL =
  process.env.RPC_URL ??
  (CHAIN.id === celo.id
    ? "https://forno.celo.org"
    : "https://forno.celo-sepolia.celo-testnet.org");

if (!process.env.AGENT_PRIVATE_KEY) {
  console.error("AGENT_PRIVATE_KEY env var is required");
  process.exit(1);
}
if (!process.env.GAME_CONTRACT) {
  console.error("GAME_CONTRACT env var is required (deployed BattleshipGame proxy)");
  process.exit(1);
}

export const gameAddress = process.env.GAME_CONTRACT as Address;

const agentAccount = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  chain: CHAIN,
  transport: http(RPC_URL),
  account: agentAccount,
});

export const AGENT_ADDRESS = agentAccount.address;
