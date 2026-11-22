"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useConfig,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import type { Address, Hash } from "viem";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/web3/chain";
import { fundAddress, usdcAddress } from "./addresses";
import { fundAbi } from "./abis/fund";
import { usdcAbi } from "./abis/usdc";
import { winnerVaultAbi } from "./abis/winnerVault";

export const USDC_DECIMALS = 6;
export const ENTRY_FEE = BigInt(52_000_000);

function requireFundAddress(): Address {
  if (!fundAddress) throw new Error("Set NEXT_PUBLIC_FUND_ADDRESS before using ArcQuant contracts.");
  return fundAddress;
}

function requireUsdcAddress(): Address {
  if (!usdcAddress) throw new Error("Set NEXT_PUBLIC_USDC_ADDRESS before using ArcQuant contracts.");
  return usdcAddress;
}

export function useArcTransaction() {
  const config = useConfig();
  const { chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const send = useCallback(
    async (request: Parameters<typeof writeContractAsync>[0]): Promise<Hash> => {
      setError(null);
      setIsConfirming(true);
      try {
        if (chainId !== ARC_TESTNET_CHAIN_ID) {
          throw new Error("Switch your wallet to Arc Testnet before submitting a transaction.");
        }
        const hash = await writeContractAsync({ ...request, chainId: ARC_TESTNET_CHAIN_ID });
        await waitForTransactionReceipt(config, { hash, chainId: ARC_TESTNET_CHAIN_ID });
        return hash;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The blockchain transaction failed.";
        setError(message);
        throw cause;
      } finally {
        setIsConfirming(false);
      }
    },
    [chainId, config, writeContractAsync],
  );

  return { send, isConfirming, error, clearError };
}

export function useCurrentBoxId() {
  return useReadContract({
    address: fundAddress,
    abi: fundAbi,
    functionName: "currentBoxId",
    query: { enabled: Boolean(fundAddress), refetchInterval: 5_000 },
  });
}

export function useBoxStatus(boxId: bigint | undefined) {
  return useReadContract({
    address: fundAddress,
    abi: fundAbi,
    functionName: "getBoxStatus",
    args: boxId === undefined ? undefined : [boxId],
    query: { enabled: Boolean(fundAddress && boxId !== undefined), refetchInterval: 5_000 },
  });
}

export function useMemberStatus(boxId: bigint | undefined, account: Address | undefined) {
  return useReadContract({
    address: fundAddress,
    abi: fundAbi,
    functionName: "getMemberStatus",
    args: boxId === undefined || !account ? undefined : [boxId, account],
    query: { enabled: Boolean(fundAddress && boxId !== undefined && account), refetchInterval: 5_000 },
  });
}

export function useActiveBoxId(account: Address | undefined) {
  return useReadContract({
    address: fundAddress,
    abi: fundAbi,
    functionName: "activeBoxOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(fundAddress && account), refetchInterval: 5_000 },
  });
}

export function useVaultPosition(vault: Address | undefined, boxId: bigint | undefined, account: Address | undefined) {
  return useReadContract({
    address: vault,
    abi: winnerVaultAbi,
    functionName: "getPosition",
    args: boxId === undefined || !account ? undefined : [boxId, account],
    query: { enabled: Boolean(vault && boxId !== undefined && account), refetchInterval: 5_000 },
  });
}

export function useUsdcBalance(account: Address | undefined) {
  return useReadContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(usdcAddress && account), refetchInterval: 10_000 },
  });
}

export function useJoinBox() {
  const { send, ...state } = useArcTransaction();
  const [isJoining, setIsJoining] = useState(false);

  const join = useCallback(async () => {
    const token = requireUsdcAddress();
    const fund = requireFundAddress();
    setIsJoining(true);
    try {
      await send({
        address: token,
        abi: usdcAbi,
        functionName: "approve",
        args: [fund, ENTRY_FEE],
      });
      return await send({
        address: fund,
        abi: fundAbi,
        functionName: "joinBox",
      });
    } finally {
      setIsJoining(false);
    }
  }, [send]);

  return { ...state, send, isConfirming: state.isConfirming || isJoining, join };
}

export function usePayInstallment() {
  const { send, ...state } = useArcTransaction();
  const pay = useCallback(
    async (boxId: bigint, amount: bigint) => {
      await send({
        address: requireUsdcAddress(),
        abi: usdcAbi,
        functionName: "approve",
        args: [requireFundAddress(), amount],
      });
      return send({
        address: requireFundAddress(),
        abi: fundAbi,
        functionName: "payInstallment",
        args: [boxId],
      });
    },
    [send],
  );
  return { ...state, send, pay };
}

export function useClaimBlockedRefund() {
  const { send, ...state } = useArcTransaction();
  const claimRefund = useCallback(
    (boxId: bigint) =>
      send({
        address: requireFundAddress(),
        abi: fundAbi,
        functionName: "claimBlockedRefund",
        args: [boxId],
      }),
    [send],
  );
  return { ...state, send, claimRefund };
}

export function usePaperTrade() {
  const { send, ...state } = useArcTransaction();
  const { vaultAddress } = useFundAndVaultAddresses();
  const recordTrade = useCallback(
    (boxId: bigint, pnl: bigint) => {
      if (!vaultAddress) throw new Error("The Fund contract has not returned its WinnerVault address.");
      return send({
        address: vaultAddress,
        abi: winnerVaultAbi,
        functionName: "recordPaperTrade",
        args: [boxId, pnl],
      });
    },
    [send, vaultAddress],
  );
  return { ...state, send, recordTrade };
}

export function useWithdrawProfit() {
  const { send, ...state } = useArcTransaction();
  const withdraw = useCallback(
    (vault: Address, boxId: bigint, amount: bigint) =>
      send({
        address: vault,
        abi: winnerVaultAbi,
        functionName: "withdrawProfit",
        args: [boxId, amount],
      }),
    [send],
  );
  return { ...state, send, withdraw };
}

export function useClaimMaturedPosition() {
  const { send, ...state } = useArcTransaction();
  const claim = useCallback(
    (vault: Address, boxId: bigint) =>
      send({
        address: vault,
        abi: winnerVaultAbi,
        functionName: "claimMaturedPosition",
        args: [boxId],
      }),
    [send],
  );
  return { ...state, send, claim };
}

export function useFundAndVaultAddresses() {
  const vault = useReadContract({
    address: fundAddress,
    abi: fundAbi,
    functionName: "vault",
    query: { enabled: Boolean(fundAddress) },
  });

  return { fundAddress, vaultAddress: vault.data };
}
