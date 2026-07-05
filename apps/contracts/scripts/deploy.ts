import hre from "hardhat";

/**
 * Deploy BattleshipGame as a UUPS proxy on the configured network.
 *
 * Env:
 *   PRIVATE_KEY        - deployer wallet (also becomes contract owner)
 *   PAYMENT_TOKEN      - cUSD (or testnet USDm) ERC-20 address used for wagers/entry
 *
 * Usage:
 *   PAYMENT_TOKEN=0x... pnpm hardhat run scripts/deploy.ts --network celo-sepolia
 *   PAYMENT_TOKEN=0x... pnpm hardhat run scripts/deploy.ts --network celo
 */
async function main() {
  const paymentToken = process.env.PAYMENT_TOKEN;
  if (!paymentToken) {
    console.error(
      "PAYMENT_TOKEN env var required (cUSD mainnet or USDm testnet address)"
    );
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log(`Deploying BattleshipGame (UUPS) on network=${hre.network.name}`);
  console.log(`  deployer      = ${await signer.getAddress()}`);
  console.log(`  paymentToken  = ${paymentToken}`);

  const factory = await hre.ethers.getContractFactory("BattleshipGame");
  const proxy = await hre.upgrades.deployProxy(factory, [paymentToken], {
    kind: "uups",
  });
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  // Read the EIP-1967 implementation slot directly. Forno returns lowercase hex;
  // the address occupies the low 20 bytes of the 32-byte slot.
  const implSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await hre.ethers.provider.getStorage(proxyAddress, implSlot);
  const implAddress = hre.ethers.getAddress("0x" + implRaw.slice(26));

  console.log(`\nBattleshipGame deployed.`);
  console.log(`  proxy         = ${proxyAddress}`);
  console.log(`  implementation= ${implAddress}`);
  console.log(
    `  verify impl:  pnpm hardhat verify --network ${hre.network.name} ${implAddress} && ` +
      `(proxy auto-verified via EIP-1967 if supported)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
