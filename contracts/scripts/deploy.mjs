import { config } from "dotenv";
config({ path: new URL("../../.env.local", import.meta.url) });
import { readFileSync } from "node:fs";
import path from "node:path";
import solc from "solc";
import { createWalletClient, createPublicClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://arc-testnet.drpc.org"] } },
});

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY is missing. Check .env.local");
}

async function main() {
  const key = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  const account = privateKeyToAccount(key);
  const transport = http(arcTestnet.rpcUrls.default.http[0]);
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport });
  const publicClient = createPublicClient({ chain: arcTestnet, transport });

  console.log("Deploying from:", account.address);

  const root = process.cwd();
  const files = ["Fund.sol", "Draw.sol", "WinnerVault.sol"];
  const sources = {};
  for (const file of files) {
    sources[`contracts/src/${file}`] = {
      content: readFileSync(path.join(root, "contracts", "src", file), "utf8"),
    };
  }

  function findImport(importPath) {
    const candidates = [
      path.resolve(root, importPath),
      path.resolve(root, "contracts", "src", importPath),
      path.resolve(root, "node_modules", importPath),
    ];
    for (const candidate of candidates) {
      try {
        return { contents: readFileSync(candidate, "utf8") };
      } catch {}
    }
    return { error: `File not found: ${importPath}` };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  console.log("Compiling contracts...");
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  for (const e of output.errors ?? []) console.error(e.formattedMessage);
  if (errors.length > 0) process.exit(1);

  const contract = output.contracts["contracts/src/Fund.sol"].Fund;

  console.log("Sending deployment transaction...");
  const hash = await walletClient.deployContract({
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    args: [],
  });
  console.log("Transaction hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fund deployed to:", receipt.contractAddress);
  console.log(`NEXT_PUBLIC_FUND_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});