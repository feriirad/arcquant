import { parseAbi } from "viem";

export const winnerVaultAbi = parseAbi([
  "function getPosition(uint256 boxId,address account) view returns ((uint256 principal,uint256 fundedProfit,uint256 paperProfit,uint256 paperLoss,uint64 maturity,uint8 paidInstallments,bool blocked,bool claimed) position,uint256 stopLossLimit)",
  "function recordPaperTrade(uint256 boxId,int256 pnl)",
  "function withdrawProfit(uint256 boxId,uint256 amount)",
  "function claimMaturedPosition(uint256 boxId)",
]);
