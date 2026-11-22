"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useBlock } from "wagmi";
import {
  useActiveBoxId,
  useBoxStatus,
  useClaimBlockedRefund,
  useClaimMaturedPosition,
  useFundAndVaultAddresses,
  useMemberStatus,
  usePaperTrade,
  usePayInstallment,
  useUsdcBalance,
  useVaultPosition,
  useWithdrawProfit,
} from "@/lib/contracts/hooks";
import { fundAddress } from "@/lib/contracts/addresses";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/web3/chain";

// Program rules, displayed to members. The contract is the source of truth.
const PROGRAM_RULES = [
  "ENTRY: Each member pays 52 USDC per month. A cycle lasts 20 months.",
  "BOX: A box has 100 members. Before the box is full, you can cancel: 50 USDC is refunded and 2 USDC is kept. After the box is full, cancellation is not possible.",
  "DRAW: Every month, 5 winners are drawn from each box using verifiable randomness. Each winner receives a 1,000 USDC trading margin.",
  "MARGIN LOCK: The 1,000 USDC margin is locked until month 20. It cannot be withdrawn or claimed before month 20, and not before your final installment is paid.",
  "PROFIT: Realized trading profit can be withdrawn at any time, without waiting for month 20.",
  "STOP-LOSS: Your maximum realized loss equals your paid installments multiplied by 50 USDC. Example: 3 paid installments = 150 USDC maximum loss.",
  "LOCK: When realized losses reach your limit, trading is locked until your next installment is paid.",
  "UNLOCK: After you pay the due installment, trading reopens the next day with the same margin and a new stop-loss limit.",
  "STAKING: Lock periods are 1, 3, 6, and 12 months at 18% APY. Staked USDC cannot be traded until it unlocks. Only the unstaked part of your balance is available for trading.",
  "NON-WINNERS: You have a one-month grace period. If you miss a second month, your account closes and all paid installments are refunded at the end of the 20-month cycle.",
  "WINNERS: If you miss even one month, your account closes. At month 20, paid installments and unwithdrawn profit are refunded.",
  "MONTH 20: After your final installment is paid, you can claim the 1,000 USDC margin minus realized trading losses. Remaining realized profit is also withdrawable.",
  "ENFORCEMENT: All rules above are enforced by the smart contract. This page only displays them.",
];

function usdc(value: bigint | undefined) {
  return value === undefined ? "--" : formatUnits(value, 6);
}

export default function Vault() {
  const { chainId, isConnected, address } = useAccount();
  const latestBlock = useBlock({ chainId: ARC_TESTNET_CHAIN_ID, watch: true });
  const activeBoxQuery = useActiveBoxId(address);
  const boxId = activeBoxQuery.data && activeBoxQuery.data > BigInt(0) ? activeBoxQuery.data : undefined;
  const memberQuery = useMemberStatus(boxId, address);
  const boxQuery = useBoxStatus(boxId);
  const { vaultAddress } = useFundAndVaultAddresses();
  const positionQuery = useVaultPosition(vaultAddress, boxId, address);
  const balanceQuery = useUsdcBalance(address);
  const payMutation = usePayInstallment();
  const paperTradeMutation = usePaperTrade();
  const withdrawMutation = useWithdrawProfit();
  const claimMutation = useClaimMaturedPosition();
  const refundMutation = useClaimBlockedRefund();
  const [paperPnl, setPaperPnl] = useState("");
  const [paperTradeError, setPaperTradeError] = useState<string | null>(null);

  const member = memberQuery.data?.[0];
  const personalRounds = memberQuery.data?.[1] ?? BigInt(0);
  const stopLossLimit = memberQuery.data?.[3];
  const box = boxQuery.data?.[0];
  const position = positionQuery.data?.[0];
  const paidInstallments = Number(member?.paidInstallments ?? 0);
  const principal = position?.principal ?? BigInt(0);
  const fundedProfit = position?.fundedProfit ?? BigInt(0);
  const paperProfit = position?.paperProfit ?? BigInt(0);
  const paperLoss = position?.paperLoss ?? BigInt(0);
  const blocked = Boolean(member?.blocked || position?.blocked);
  const paperTradingLocked =
    !member?.hasWon ||
    blocked ||
    Boolean(position?.claimed) ||
    (stopLossLimit !== undefined && paperLoss >= stopLossLimit);
  const currentTime = latestBlock.data?.timestamp ?? BigInt(0);
  const nextRound = Number(box?.nextRound ?? 0);

  let owedInstallments = 0;
  for (let round = 0; round <= nextRound && round < 20; round += 1) {
    if ((personalRounds & (BigInt(1) << BigInt(round))) === BigInt(0)) owedInstallments += 1;
  }
  const paymentAmount = BigInt(owedInstallments) * BigInt(52_000_000);

  // principal (1,000 USDC margin) is claimable only after maturity AND after the final installment is paid
  const canClaimPrincipal = Boolean(
    position &&
      principal > BigInt(0) &&
      !position.claimed &&
      !blocked &&
      owedInstallments === 0 &&
      currentTime >= position.maturity
  );

  // TODO: replace this estimate with the exact cycle end timestamp from the contract
  const cycleMaturity = box ? BigInt(box.startedAt) + BigInt(20 * 30 * 24 * 60 * 60) : BigInt(0);
  const canClaimRefund = Boolean(member?.blocked && box?.completed && currentTime >= cycleMaturity);

  const transactionError =
    paperTradeError ??
    payMutation.error ??
    paperTradeMutation.error ??
    withdrawMutation.error ??
    claimMutation.error ??
    refundMutation.error;

  const readError =
    activeBoxQuery.error?.message ??
    memberQuery.error?.message ??
    boxQuery.error?.message ??
    positionQuery.error?.message ??
    balanceQuery.error?.message;

  async function submitPaperTrade() {
    if (!boxId) return;
    setPaperTradeError(null);
    try {
      const pnl = parseUnits(paperPnl, 6);
      await paperTradeMutation.recordTrade(boxId, pnl);
      setPaperPnl("");
      await positionQuery.refetch();
    } catch (cause) {
      setPaperTradeError(cause instanceof Error ? cause.message : "Could not record the paper trade.");
    }
  }

  async function payInstallment() {
    if (!boxId) return;
    try {
      await payMutation.pay(boxId, paymentAmount);
      await Promise.all([memberQuery.refetch(), positionQuery.refetch(), boxQuery.refetch()]);
    } catch {
      // The transaction hook exposes its error below.
    }
  }

  async function claimRefund() {
    if (!boxId) return;
    try {
      await refundMutation.claimRefund(boxId);
    } catch {
      // The transaction hook exposes its error below.
    }
  }

  async function withdrawProfits() {
    if (!vaultAddress || !boxId || fundedProfit === BigInt(0)) return;
    try {
      await withdrawMutation.withdraw(vaultAddress, boxId, fundedProfit);
      await positionQuery.refetch();
    } catch {
      // The transaction hook exposes its error below.
    }
  }

  async function claimPrincipal() {
    if (!vaultAddress || !boxId) return;
    try {
      await claimMutation.claim(vaultAddress, boxId);
      await positionQuery.refetch();
    } catch {
      // The transaction hook exposes its error below.
    }
  }

  return (
    <main className="relative min-h-screen p-4 font-mono text-white md:p-8">
      <div className="fixed inset-0 z-[-1]">
        <Image src="/hero-1.png" alt="" fill className="object-cover opacity-80" unoptimized />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-600 pb-3 text-sm">
          <div className="flex flex-wrap gap-4 font-bold">
            <Link href="/dashboard" className="text-gray-300 hover:underline">[ &lt; DASHBOARD ]</Link>
            <span>VAULT_TERMINAL</span>
          </div>
          <ConnectButton />
        </header>

        {chainId !== undefined && chainId !== ARC_TESTNET_CHAIN_ID && (
          <p role="alert" className="mb-4 border border-amber-500/60 bg-black/70 p-3 text-xs text-amber-200">
            WRONG_NETWORK: switch your wallet to Arc Testnet.
          </p>
        )}
        {!fundAddress && (
          <p role="alert" className="mb-4 border border-amber-500/60 bg-black/70 p-3 text-xs text-amber-200">
            CONTRACT_NOT_CONFIGURED: set NEXT_PUBLIC_FUND_ADDRESS after deploying Fund.sol.
          </p>
        )}
        {readError && (
          <p role="alert" className="mb-4 break-words border border-red-500/60 bg-black/70 p-3 text-xs text-red-300">
            CONTRACT_READ_ERROR: {readError}
          </p>
        )}
        {!isConnected && (
          <p className="mb-4 border border-gray-600 bg-black/70 p-3 text-xs text-gray-300">
            CONNECT_WALLET_TO_LOAD_YOUR_ON_CHAIN_POSITION
          </p>
        )}

        <section className="border border-gray-600 bg-black/50">
          <h1 className="border-b border-gray-600 bg-white/5 p-3 text-sm font-bold">[ VAULT_STATISTICS ]</h1>
          <div className="grid grid-cols-2 divide-x divide-gray-600 border-b border-gray-600 text-sm md:grid-cols-4">
            <div className="p-4">
              <div className="mb-1 text-xs text-gray-400">LOCKED_MARGIN</div>
              <div className="text-lg font-bold">{usdc(principal)} USDC</div>
              <div className="mt-1 text-[10px] text-gray-500">LOCKED_UNTIL_MONTH_20_AND_FINAL_INSTALLMENT</div>
            </div>
            <div className="p-4">
              <div className="mb-1 text-xs text-gray-400">REALIZED_PROFIT</div>
              <div className="text-lg font-bold text-green-300">{usdc(fundedProfit)} USDC</div>
              <div className="mt-1 text-[10px] text-gray-500">WITHDRAWABLE_ANYTIME</div>
            </div>
            <div className="p-4">
              <div className="mb-1 text-xs text-gray-400">DYNAMIC_STOP_LOSS</div>
              <div className="text-lg font-bold text-red-300">{usdc(stopLossLimit)} USDC</div>
              <div className="mt-1 text-[10px] text-gray-500">{paidInstallments} PERSONAL_INSTALLMENTS_PAID</div>
            </div>
            <div className="p-4">
              <div className="mb-1 text-xs text-gray-400">MEMBER_STATUS</div>
              <div className="text-lg font-bold">
                {member?.blocked ? "BLOCKED" : member?.hasWon ? "WINNER" : member?.joined ? "ACTIVE" : "NONE"}
              </div>
              <div className="mt-1 text-[10px] text-gray-500">BOX #{boxId?.toString() ?? "--"}</div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 bg-white/5 p-4 md:flex-row md:items-center">
            <div className="text-xs">
              <p className="text-gray-200">NEXT_ROUND: {box ? `${Number(box.nextRound) + 1} / 20` : "-- / 20"}</p>
              <p className="mt-1 text-gray-400">
                PERSONAL_PAYMENT_DUE: {owedInstallments} INSTALLMENT(S) / {usdc(paymentAmount)} USDC
                {owedInstallments > 2 ? " / OPERATOR_ACTION_REQUIRED" : ""}
              </p>
              <p className="mt-1 text-gray-500">ERC20_USDC_BALANCE: {usdc(balanceQuery.data)} USDC</p>
            </div>
            <button
              type="button"
              onClick={() => void payInstallment()}
              disabled={
                !isConnected ||
                chainId !== ARC_TESTNET_CHAIN_ID ||
                !member?.joined ||
                blocked ||
                owedInstallments === 0 ||
                owedInstallments > 2 ||
                payMutation.isConfirming
              }
              className="border border-gray-300 px-6 py-2 text-sm transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {payMutation.isConfirming ? "[ WAITING_FOR_TRANSACTION ]" : "[ APPROVE_AND_PAY_DUE_INSTALLMENTS ]"}
            </button>
          </div>
        </section>

        <section className="mt-6 border border-gray-600 bg-black/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-600 bg-white/5 p-3 text-sm font-bold">
            <span>[ PAPER_TRADING_SIMULATOR ]</span>
            {paperTradingLocked && <span className="text-red-300">[ SIMULATION_LOCKED ]</span>}
          </div>
          <div className="grid gap-6 p-4 md:grid-cols-3">
            <div className="border-b border-gray-600 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4">
              <h2 className="mb-2 text-xs font-bold text-gray-200">PAPER_ACCOUNT</h2>
              <p className="mb-4 text-[10px] leading-relaxed text-gray-400">
                This is a test-only PnL ledger. It does not execute spot orders or create withdrawable profits.
              </p>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-gray-400">SIMULATED_PROFIT</dt><dd>{usdc(paperProfit)} USDC</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-400">SIMULATED_LOSS</dt><dd className="text-red-300">{usdc(paperLoss)} USDC</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-gray-400">MARGIN</dt><dd>{usdc(principal)} USDC</dd></div>
              </dl>
              <label className="mt-5 block text-xs text-gray-300">
                SIMULATED_PNL_USDC
                <input
                  type="number"
                  step="0.000001"
                  value={paperPnl}
                  onChange={(event) => setPaperPnl(event.target.value)}
                  placeholder="e.g. 12.50 or -10"
                  className="mt-1 w-full border border-gray-500 bg-black/60 p-2 text-white outline-none focus:border-white"
                />
              </label>
              <button
                type="button"
                onClick={() => void submitPaperTrade()}
                disabled={
                  !isConnected ||
                  chainId !== ARC_TESTNET_CHAIN_ID ||
                  paperTradingLocked ||
                  !paperPnl ||
                  paperTradeMutation.isConfirming
                }
                className="mt-3 w-full border border-gray-400 py-2 text-xs hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {paperTradeMutation.isConfirming ? "[ WAITING_FOR_TRANSACTION ]" : "[ RECORD_PAPER_TRADE ]"}
              </button>
            </div>

            <div className="md:col-span-2">
              <h2 className="mb-3 text-xs font-bold text-gray-200">[ ON_CHAIN_POSITION ]</h2>
              <div className="space-y-3 border border-gray-700 p-3 text-xs">
                <div className="flex justify-between gap-3"><span className="text-gray-400">BOX_START</span><span>{box?.startedAt ? new Date(Number(box.startedAt) * 1000).toLocaleString() : "--"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-400">MARGIN_UNLOCKS</span><span>{position?.maturity ? new Date(Number(position.maturity) * 1000).toLocaleString() : "--"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-400">POSITION_CLAIMED</span><span>{position?.claimed ? "YES" : "NO"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-400">VAULT_ADDRESS</span><span className="break-all text-right">{vaultAddress ?? "NOT_DEPLOYED"}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {member?.blocked && (
                  <button
                    type="button"
                    onClick={() => void claimRefund()}
                    disabled={!canClaimRefund || refundMutation.isConfirming}
                    className="border border-gray-400 px-5 py-2 text-xs hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {refundMutation.isConfirming ? "[ WAITING... ]" : "[ CLAIM_BLOCKED_MEMBER_REFUND ]"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void withdrawProfits()}
                  disabled={
                    !isConnected ||
                    chainId !== ARC_TESTNET_CHAIN_ID ||
                    fundedProfit === BigInt(0) ||
                    withdrawMutation.isConfirming
                  }
                  className="border border-gray-400 px-5 py-2 text-xs hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {withdrawMutation.isConfirming ? "[ WAITING... ]" : "[ WITHDRAW_REALIZED_PROFIT ]"}
                </button>
                <button
                  type="button"
                  onClick={() => void claimPrincipal()}
                  disabled={!canClaimPrincipal || claimMutation.isConfirming}
                  className="border border-gray-400 px-5 py-2 text-xs hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {claimMutation.isConfirming ? "[ WAITING... ]" : "[ CLAIM_MARGIN_AFTER_MONTH_20 ]"}
                </button>
              </div>
            </div>
          </div>
          {transactionError && (
            <p role="alert" className="m-4 break-words border border-red-500/60 p-3 text-xs text-red-300">
              TRANSACTION_ERROR: {transactionError}
            </p>
          )}
        </section>

        <section className="mt-6 border border-gray-600 bg-black/50">
          <h2 className="border-b border-gray-600 bg-white/5 p-3 text-sm font-bold">[ PROGRAM_RULES ]</h2>
          <ol className="space-y-2 p-4 text-[11px] leading-relaxed text-gray-300">
            {PROGRAM_RULES.map((rule, i) => (
              <li key={i}>
                {String(i + 1).padStart(2, "0")}. {rule}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}