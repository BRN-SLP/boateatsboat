import hre from "hardhat";

/**
 * Verify the BattleshipGame implementation contract on Celoscan.
 *
 * UUPS proxies expose the implementation address in the EIP-1967 storage slot.
 * Celoscan (and Etherscan) verify the *implementation* source; the proxy is
 * then auto-resolved via the standard EIP-1967 slot by the explorer.
 *
 * Usage:
 *   PROXY_ADDRESS=0x... pnpm hardhat run scripts/verify.ts --network celo-sepolia
 *   PROXY_ADDRESS=0x... pnpm hardhat run scripts/verify.ts --network celo
 *
 * Env:
 *   PROXY_ADDRESS     The deployed UUPS proxy address.
 *   ETHERSCAN_API_KEY Celoscan API key (already in .env).
 */
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress || !hre.ethers.isAddress(proxyAddress)) {
    console.error(
      "Usage: PROXY_ADDRESS=0x... pnpm hardhat run scripts/verify.ts --network <net>"
    );
    process.exit(1);
  }

  // Read the EIP-1967 implementation slot directly.
  const implSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await hre.ethers.provider.getStorage(proxyAddress, implSlot);
  const implAddress = hre.ethers.getAddress("0x" + implRaw.slice(26));

  console.log(`Verifying on network=${hre.network.name}`);
  console.log(`  proxy         = ${proxyAddress}`);
  console.log(`  implementation= ${implAddress}`);

  // No constructor args for the implementation (UUPS initializer runs via proxy).
  try {
    await hre.run("verify:verify", {
      address: implAddress,
      constructorArguments: [],
    });
    console.log("\nImplementation verified.");
  } catch (e: any) {
    if (
      e.message?.includes("Already Verified") ||
      e.message?.includes("already verified")
    ) {
      console.log("\nImplementation already verified. Nothing to do.");
    } else {
      throw e;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
