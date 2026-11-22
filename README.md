# ArcQuant MVP

ArcQuant is an Arc Testnet savings-box MVP. The current workspace uses Next.js 16 App Router, Wagmi 2, RainbowKit, Viem, and Supabase; it is not the Next.js 14 version described in the original product brief.

## Local setup

1. Copy `.env.example` to `.env.local` and configure the WalletConnect project ID and Supabase values.
2. Apply [`supabase/schema.sql`](./supabase/schema.sql) to the Supabase project.
3. Compile the contracts and generate their full ABI JSON files:

   ```powershell
   npm run contracts:abi
   ```

4. Deploy `Fund` to Arc Testnet with the official Arc Foundry tooling. Its constructor takes the Arc Testnet USDC ERC-20 address and fee-recipient wallet. Copy the deployed Fund address into `NEXT_PUBLIC_FUND_ADDRESS`.
5. Start the app:

   ```powershell
   npm run dev
   ```

The official Arc Testnet RPC is `https://rpc.testnet.arc.io`; its chain ID is `5042002`. The Arc USDC ERC-20 interface is `0x3600000000000000000000000000000000000000` and uses **6 decimals** for contract transfers. Arc's native USDC gas balance uses **18 decimals**; these are different representations of the same network asset.

## Contract and funding rules

- Each member pays 52 USDC per installment: 50 USDC goes to that round's prize pool and 2 USDC goes to the configured fee recipient.
- A box starts only after all 100 member slots are filled. Each of its 20 rounds must have 5,000 USDC in the pool before a draw can be committed.
- The operator must explicitly fund `sponsorReserve` with real USDC. `sponsorCurrentRound` uses this reserve to cover missing installments and keep a round fully funded. A blocked member remains in the draw; if they win, their award is returned to the reserve.
- Refunds of a blocked member's personal installments are payable only from the actual reserve balance. They revert rather than creating an unfunded USDC liability.
- A winner's 1,000 USDC principal is held in `WinnerVault` until the 20-month maturity. The on-chain paper-trading PnL is simulation only; it cannot move principal or create withdrawable profits. Only owner-funded USDC credits count as withdrawable profits.
- Commit-reveal Fisher-Yates draws are for testnet demonstration only. A single operator can withhold or grind a seed. Use a verifiable randomness service and independent security review before handling real funds.
- Supabase assigns an eight-digit user ID when an email account is created. Wallet linking requires an authenticated Supabase session and a one-time signed challenge. Box and membership tables are mirrors for a future event indexer; the contract remains authoritative.

## Important deployment warning

This repository contains an MVP implementation, not an audited or production-ready financial protocol. Test the accounting and failure cases on Arc Testnet, fund and monitor the operator reserve, deploy with a multisig, and obtain an independent Solidity/security review before depositing real assets. No DEX execution or automated trade settlement is included.
