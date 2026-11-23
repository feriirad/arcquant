"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// TODO before launch: replace with the real APY and balances from the contract or API
const APY = 18;
const MIN_STAKE = 10;
const TRADING_BALANCE = 1000;

const TIERS = [
  { key: "1m", label: "1 month", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
  { key: "6m", label: "6 months", days: 180 },
  { key: "1y", label: "1 year", days: 365 },
];

type Position = {
  id: number;
  amount: number;
  tierKey: string;
  days: number;
  startedAt: Date;
  unlockAt: Date;
};

const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtDate = (d: Date) =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const glass: React.CSSProperties = {
  border: "1px solid rgba(139,199,255,0.35)",
  background: "linear-gradient(180deg, rgba(20,28,70,0.55), rgba(5,9,28,0.8))",
  boxShadow: "0 0 24px rgba(70,160,255,0.2)",
};

const pill = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  borderRadius: 99,
  border: active ? "none" : "1px solid rgba(139,199,255,0.3)",
  background: active ? "linear-gradient(90deg,#8b6dc6,#ff4d6d)" : "transparent",
  color: active ? "#fff" : "#91a8d1",
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.08em",
  fontSize: 13,
  cursor: "pointer",
});

export default function StakePage() {
  const [tierIndex, setTierIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  // current time is read only in the browser, after the page loads
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const tier = TIERS[tierIndex];

  // staked amount is locked and cannot be traded
  const lockedStake = positions.reduce((sum, p) => sum + p.amount, 0);
  const tradable = TRADING_BALANCE - lockedStake;

  const amountNum = Number(amount) || 0;
  const reward = (amountNum * APY * tier.days) / (100 * 365);
  const unlockPreview = now ? fmtDate(addDays(now, tier.days)) : "--";

  function stake() {
    if (amountNum < MIN_STAKE) {
      setMessage(`Minimum stake is ${MIN_STAKE} USDC.`);
      return;
    }
    if (amountNum > tradable) {
      setMessage("Not enough tradable USDC. Stake cannot be more than your free balance.");
      return;
    }
    // TODO: send the stake transaction to the staking contract here
    const start = new Date();
    setPositions((prev) => [
      ...prev,
      {
        id: Date.now(),
        amount: amountNum,
        tierKey: tier.key,
        days: tier.days,
        startedAt: start,
        unlockAt: addDays(start, tier.days),
      },
    ]);
    setMessage(`Staked ${fmt(amountNum)} USDC for ${tier.label}. This amount is locked from trading.`);
    setAmount("");
  }

  function withdraw(p: Position) {
    const current = new Date();
    if (current < p.unlockAt) {
      setMessage(`This stake unlocks on ${fmtDate(p.unlockAt)}.`);
      return;
    }
    // TODO: send the withdraw transaction to the staking contract here
    const payout = p.amount + (p.amount * APY * p.days) / (100 * 365);
    setPositions((prev) => prev.filter((x) => x.id !== p.id));
    setMessage(`Withdrawn ${fmt(payout)} USDC including reward.`);
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#030716",
        color: "#e8ecff",
        fontFamily: "'Outfit', sans-serif",
        overflow: "auto",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Outfit:wght@400;600;700&family=Space+Mono:wght@700&display=swap');
        .stake-input { background: rgba(3,7,22,0.7); color: #e8ecff; border: 1px solid rgba(139,199,255,0.25); border-radius: 12px; padding: 10px 14px; font-size: 14px; width: 100%; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
      `}</style>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(89,199,255,0.16), transparent 60%), radial-gradient(ellipse at 90% 100%, rgba(255,77,109,0.1), transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto", padding: "20px 28px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            href="/"
            style={{
              padding: "6px 18px",
              borderRadius: 99,
              border: "1px solid rgba(139,199,255,0.5)",
              background: "rgba(10,14,35,0.7)",
              color: "#fff",
              fontSize: 12,
              textDecoration: "none",
              boxShadow: "0 0 10px rgba(70,160,255,0.35)",
            }}
          >
            back
          </Link>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "0.12em" }}>
            STAKE · USDC
          </div>
          <div style={{ width: 80 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { k: "tradable USDC", v: fmt(tradable), c: "#59c7ff" },
            { k: "locked in stake", v: fmt(lockedStake), c: "#8b6dc6" },
            { k: "APY", v: `${APY}%`, c: "#75e7c2" },
          ].map((card) => (
            <div key={card.k} style={{ ...glass, borderRadius: "50px 50px 18px 18px", padding: "18px 22px 14px" }}>
              <div style={{ fontSize: 12, color: "#91a8d1", marginBottom: 6 }}>{card.k}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: card.c, textShadow: `0 0 12px ${card.c}` }}>
                {card.v}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18 }}>
          <div style={{ ...glass, borderRadius: "70px 70px 22px 22px", padding: "28px 26px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TIERS.map((t, i) => (
                <button key={t.key} onClick={() => setTierIndex(i)} style={pill(i === tierIndex)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#91a8d1", marginBottom: 6 }}>amount (USDC)</div>
              <input
                className="stake-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`min ${MIN_STAKE}`}
              />
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(((tradable * p) / 100).toFixed(2))}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 10,
                    border: "1px solid rgba(139,199,255,0.25)",
                    background: "transparent",
                    color: "#91a8d1",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {p === 100 ? "max" : `${p}%`}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "#aebfe0", lineHeight: 1.7 }}>
              <div>reward for this lock: {fmt(reward)} USDC</div>
              <div>unlocks on: {unlockPreview}</div>
              <div style={{ color: "#ff8fa3" }}>staked amount cannot be traded until it unlocks</div>
            </div>

            <button
              onClick={stake}
              style={{
                padding: 12,
                borderRadius: 99,
                border: "none",
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.12em",
                fontSize: 15,
                color: "#fff",
                background: "linear-gradient(90deg,#2a6dff,#19c3ff)",
                boxShadow: "0 0 18px rgba(89,199,255,0.35)",
                cursor: "pointer",
              }}
            >
              STAKE
            </button>

            {message && <div style={{ color: "#75e7c2", fontSize: 12 }}>{message}</div>}
          </div>

          <div style={{ ...glass, borderRadius: "22px 90px 22px 22px", padding: "26px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "0.08em" }}>
              YOUR STAKES
            </div>

            {positions.length === 0 && <div style={{ fontSize: 12, color: "#91a8d1" }}>No active stake yet.</div>}

            {positions.map((p) => {
              const unlocked = now !== null && now >= p.unlockAt;
              const label = TIERS.find((t) => t.key === p.tierKey)?.label ?? "";
              return (
                <div
                  key={p.id}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(147,182,239,0.18)",
                    padding: "10px 14px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(p.amount)} USDC</span>
                  <span style={{ color: "#91a8d1", textAlign: "right" }}>{label}</span>
                  <span style={{ color: "#aebfe0" }}>unlock {fmtDate(p.unlockAt)}</span>
                  <button
                    onClick={() => withdraw(p)}
                    style={{
                      justifySelf: "end",
                      padding: "4px 12px",
                      borderRadius: 99,
                      border: "1px solid rgba(139,199,255,0.35)",
                      background: "transparent",
                      color: unlocked ? "#75e7c2" : "#91a8d1",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {unlocked ? "withdraw" : "locked"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}