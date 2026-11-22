import { parseAbi } from "viem";

export const fundAbi = parseAbi([
  "function currentBoxId() view returns (uint256)",
  "function activeBoxOf(address account) view returns (uint256)",
  "function getBoxStatus(uint256 boxId) view returns ((uint64 startedAt,uint8 membersCount,uint8 nextRound,uint256 prizePool,bool started,bool completed) box,uint8 fundedMembers)",
  "function getMemberStatus(uint256 boxId,address account) view returns ((bool joined,bool blocked,bool hasWon,uint8 paidInstallments,uint8 winRound) member,uint256 personalRounds,uint256 operatorRounds,uint256 stopLossLimit)",
  "function getMembers(uint256 boxId) view returns (address[] accounts)",
  "function joinBox()",
  "function payInstallment(uint256 boxId)",
  "function claimBlockedRefund(uint256 boxId)",
  "function draw() view returns (address)",
  "function vault() view returns (address)",
]);
