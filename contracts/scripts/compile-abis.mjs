import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const contractFiles = ["Fund.sol", "Draw.sol", "WinnerVault.sol"];
const sources = Object.fromEntries(
  contractFiles.map((name) => {
    const sourcePath = path.join(root, "contracts", "src", name);
    return [`contracts/src/${name}`, { content: readFileSync(sourcePath, "utf8") }];
  }),
);

function findImport(importPath) {
  const candidates = [
    path.resolve(root, importPath),
    path.resolve(root, "contracts", "src", importPath),
    path.resolve(root, "node_modules", importPath),
  ];
  const resolved = candidates.find(existsSync);
  if (!resolved) return { error: `Import not found: ${importPath}` };
  return { contents: readFileSync(resolved, "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.deployedBytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
for (const entry of output.errors ?? []) {
  if (entry.severity === "error") console.error(entry.formattedMessage);
}
if (errors.length > 0) process.exit(1);

const outputDirectory = path.join(root, "src", "lib", "contracts", "abis", "generated");
mkdirSync(outputDirectory, { recursive: true });

for (const name of ["Fund", "Draw", "WinnerVault"]) {
  const contract = output.contracts[`contracts/src/${name}.sol`][name];
  const runtimeBytes = contract.evm.deployedBytecode.object.length / 2;
  if (runtimeBytes > 24_576) {
    console.error(`${name} runtime bytecode exceeds the EVM 24,576-byte limit (${runtimeBytes} bytes).`);
    process.exitCode = 1;
  }
  writeFileSync(
    path.join(outputDirectory, `${name}.json`),
    `${JSON.stringify(contract.abi, null, 2)}\n`,
  );
  console.log(`${name}: ${runtimeBytes} runtime bytecode bytes`);
}

if (process.exitCode !== 1) {
  console.log("Compiled Solidity contracts and generated Fund, Draw, and WinnerVault ABIs.");
}
