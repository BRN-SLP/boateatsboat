import hre from "hardhat";

/**
 * Upgrade the BattleshipGame UUPS proxy to a new implementation.
 *
 * The proxy address stays the same; only the implementation slot changes.
 * All on-chain storage (games, pending shots, ELO) is preserved.
 *
 * Env:
 *   PROXY_ADDRESS - the existing ERC1967 proxy address to upgrade
 *
 * Usage:
 *   PROXY_ADDRESS=0x... pnpm hardhat run scripts/upgrade.ts --network celo-sepolia
 *   PROXY_ADDRESS=0x... pnpm hardhat run scripts/upgrade.ts --network celo
 */
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    console.error("PROXY_ADDRESS env var required (existing proxy to upgrade)");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log(`Upgrading BattleshipGame proxy on network=${hre.network.name}`);
  console.log(`  proxy         = ${proxyAddress}`);
  console.log(`  signer/owner = ${await signer.getAddress()}`);

  const factory = await hre.ethers.getContractFactory("BattleshipGame");
  const proxy = await hre.upgrades.upgradeProxy(proxyAddress, factory, {
    kind: "uups",
  });
  await proxy.waitForDeployment();

  const implSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await hre.ethers.provider.getStorage(proxyAddress, implSlot);
  const newImpl = hre.ethers.getAddress("0x" + implRaw.slice(26));

  console.log(`\nUpgrade complete.`);
  console.log(`  proxy (unchanged) = ${proxyAddress}`);
  console.log(`  new implementation= ${newImpl}`);
  console.log(
    `  verify impl:  pnpm hardhat verify --network ${hre.network.name} ${newImpl}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
