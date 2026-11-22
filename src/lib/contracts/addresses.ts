import { getAddress, isAddress, type Address } from "viem";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

function configuredAddress(name: string, value: string | undefined, fallback?: string): Address | undefined {
  const address = value ?? fallback;
  if (!address) return undefined;
  if (!isAddress(address)) throw new Error(`${name} must be a valid EVM address.`);
  return getAddress(address);
}

export const usdcAddress = configuredAddress(
  "NEXT_PUBLIC_USDC_ADDRESS",
  process.env.NEXT_PUBLIC_USDC_ADDRESS,
  ARC_TESTNET_USDC,
);

export const fundAddress = configuredAddress(
  "NEXT_PUBLIC_FUND_ADDRESS",
  process.env.NEXT_PUBLIC_FUND_ADDRESS,
);
