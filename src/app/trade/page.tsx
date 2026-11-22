"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

declare global {
  interface Window {
    TradingView?: any;
  }
}

const BASES = [
  "ARC", "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK",
  "DOT", "LTC", "TRX", "UNI", "ATOM", "NEAR", "APT", "OP", "ARB",
];

// every coin trades against USDC. Only these coins also have a USDT market.
const USDT_MARKETS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT",
  "LTC", "TRX", "UNI", "ATOM", "NEAR", "APT", "OP", "ARB",
]);

const FEE_RATE = 0.001; // trading fee, confirm before launch
const CONVERT_FEE = 0.0005; // USDT to USDC conversion fee, confirm before launch
const PERCENTS = [25, 50, 75, 100];

// TODO before launch: replace these with real values from the contract or API
const IS_WINNER = false; // true only for members who won a 1,000 USDC draw
const WALLET: Record<"USDC" | "USDT", number> = { USDC: 0, USDT: 0 };
const COIN_BALANCE: Record<string, number> = {};

function TradingViewChart({ symbol }: { symbol: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = () => {
      if (!hostRef.current || !window.TradingView) return;
      hostRef.current.innerHTML = "";
      const id = `tv_${Math.random().toString(36).slice(2)}`;
      const inner = document.createElement("div");
      inner.id = id;
      inner.style.width = "100%";
      inner.style.height = "100%";
      hostRef.current.appendChild(inner);

      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval: "60",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#030716",
        backgroundColor: "#030716",
        gridColor: "rgba(89,199,255,0.06)",
        enable_publishing: false,
        allow_symbol_change: false,
        withdateranges: true,
        container_id: id,
      });
    };

    if (window.TradingView) {
      mount();
      return;
    }

    const src = "https://s3.tradingview.com/tv.js";
    let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", mount);
    return () => script?.removeEventListener("load", mount);
  }, [symbol]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}

export default function TradePage() {
  const [base, setBase] = useState("ARC");
  const [quote, setQuote] = useState<"USDC" | "USDT">("USDC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const locked = !IS_WINNER;
  const hasUsdt = USDT_MARKETS.has(base);
  const activeQuote = quote === "USDT" && !hasUsdt ? "USDC" : quote;
  const symbol = `BINANCE:${base}${activeQuote}`;

  const quoteBalance = WALLET[activeQuote];
  const baseBalance = COIN_BALANCE[base] ?? 0;

  const priceNum = Number(price) || 0;
  const amountNum = Number(amount) || 0;
  const gross = amountNum * priceNum;
  const fee = gross * FEE_RATE;
  const total = side === "buy" ? gross + fee : gross - fee;

  function applyPercent(p: number) {
    const max =
      side === "buy"
        ? priceNum > 0
          ? quoteBalance / priceNum
          : 0
        : baseBalance;
    setAmount(((max * p) / 100).toFixed(6));
  }

  function placeOrder() {
    if (locked) {
      setMessage("Trading is open only to 1,000 USDC draw winners.");
      return;
    }
    if (priceNum <= 0 || amountNum <= 0) {
      setMessage("Enter price and amount first.");
      return;
    }
    if (side === "buy" && total > quoteBalance) {
      setMessage(`Not enough ${activeQuote}. Convert or deposit first.`);
      return;
    }
    if (side === "sell" && amountNum > baseBalance) {
      setMessage(`Not enough ${base} in your wallet.`);
      return;
    }
    // TODO: send the order to the exchange contract or API here
    setMessage(`${side === "buy" ? "Buy" : "Sell"} order sent: ${amountNum} ${base} at ${priceNum} ${activeQuote}.`);
    setAmount("");
  }

  function convertUsdt() {
    if (locked) {
      setMessage("Conversion is open only to draw winners.");
      return;
    }
    // TODO: call the USDT to USDC swap here
    setMessage(`Convert USDT to USDC. Conversion fee ${CONVERT_FEE * 100}%.`);
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#030716",
        color: "#e8ecff",
        fontFamily: "'Outfit', sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: "12px 18px",
        gap: 10,
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Outfit:wght@400;600;700&display=swap');
        .tv-select { background: rgba(10,14,35,0.7); color: #e8ecff; border: 1px solid rgba(139,199,255,0.35); border-radius: 99px; padding: 5px 14px; font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 0.06em; font-size: 13px; }
        .tv-input { background: rgba(3,7,22,0.7); color: #e8ecff; border: 1px solid rgba(139,199,255,0.25); border-radius: 10px; padding: 6px 10px; font-size: 12px; width: 110px; }
        .tv-input:disabled, .tv-select:disabled { opacity: 0.4; }
      `}</style>

      {/* top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <Link
          href="/"
          style={{
            padding: "5px 16px",
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

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="tv-select" value={base} onChange={(e) => setBase(e.target.value)}>
            {BASES.map((b) => (
              <option key={b} value={b} style={{ background: "#030716" }}>
                {b}
              </option>
            ))}
          </select>
          <select
            className="tv-select"
            value={activeQuote}
            onChange={(e) => setQuote(e.target.value as "USDC" | "USDT")}
          >
            <option value="USDC" style={{ background: "#030716" }}>USDC</option>
            {hasUsdt && <option value="USDT" style={{ background: "#030716" }}>USDT</option>}
          </select>
        </div>

        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.12em", fontSize: 18 }}>
          TRADE · SPOT
        </div>
      </div>

      {/* chart */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: "1px solid rgba(139,199,255,0.3)",
          borderRadius: 40,
          background: "rgba(5,9,28,0.6)",
          boxShadow: "0 0 24px rgba(70,160,255,0.2)",
          padding: 6,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <TradingViewChart symbol={symbol} />
      </div>

      {/* compact order bar */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          border: "1px solid rgba(139,199,255,0.3)",
          borderRadius: 18,
          background: "linear-gradient(90deg, rgba(20,28,70,0.6), rgba(5,9,28,0.85))",
          padding: "8px 14px",
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          <button
            disabled={locked}
            onClick={() => setSide("buy")}
            style={{
              padding: "5px 14px",
              borderRadius: 99,
              border: "none",
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#fff",
              background: side === "buy" ? "linear-gradient(90deg,#2a6dff,#19c3ff)" : "transparent",
              boxShadow: side === "buy" ? "0 0 12px rgba(25,195,255,0.4)" : "none",
              cursor: locked ? "not-allowed" : "pointer",
              opacity: locked ? 0.4 : 1,
            }}
          >
            BUY
          </button>
          <button
            disabled={locked}
            onClick={() => setSide("sell")}
            style={{
              padding: "5px 14px",
              borderRadius: 99,
              border: "none",
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#fff",
              background: side === "sell" ? "linear-gradient(90deg,#8b6dc6,#ff4d6d)" : "transparent",
              boxShadow: side === "sell" ? "0 0 12px rgba(255,77,109,0.4)" : "none",
              cursor: locked ? "not-allowed" : "pointer",
              opacity: locked ? 0.4 : 1,
            }}
          >
            SELL
          </button>
        </div>

        <label style={{ color: "#91a8d1" }}>
          price ({activeQuote}){" "}
          <input
            className="tv-input"
            disabled={locked}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>

        <label style={{ color: "#91a8d1" }}>
          amount ({base}){" "}
          <input
            className="tv-input"
            disabled={locked}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>

        <div style={{ display: "flex", gap: 4 }}>
          {PERCENTS.map((p) => (
            <button
              key={p}
              disabled={locked}
              onClick={() => applyPercent(p)}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(139,199,255,0.25)",
                background: "transparent",
                color: "#91a8d1",
                fontSize: 11,
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.4 : 1,
              }}
            >
              {p === 100 ? "max" : `${p}%`}
            </button>
          ))}
        </div>

        <div style={{ color: "#aebfe0", fontSize: 11, lineHeight: 1.5 }}>
          <div>total: {total > 0 ? total.toFixed(2) : "0.00"} {activeQuote}</div>
          <div>fee: {fee > 0 ? fee.toFixed(2) : "0.00"} {activeQuote}</div>
        </div>

        <div style={{ color: "#91a8d1", fontSize: 11, lineHeight: 1.5 }}>
          <div>USDC: {WALLET.USDC.toFixed(2)}</div>
          <div>USDT: {WALLET.USDT.toFixed(2)}</div>
          <div>{base}: {baseBalance.toFixed(4)}</div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            disabled={locked || WALLET.USDT <= 0}
            onClick={convertUsdt}
            style={{
              padding: "6px 12px",
              borderRadius: 99,
              border: "1px solid rgba(139,199,255,0.4)",
              background: "transparent",
              color: "#e8ecff",
              fontSize: 11,
              cursor: locked ? "not-allowed" : "pointer",
              opacity: locked ? 0.4 : 1,
            }}
          >
            convert USDT to USDC
          </button>
        </div>

        <button
          disabled={locked}
          onClick={placeOrder}
          style={{
            marginLeft: "auto",
            padding: "8px 22px",
            borderRadius: 99,
            border: "none",
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#fff",
            background: side === "buy" ? "linear-gradient(90deg,#2a6dff,#19c3ff)" : "linear-gradient(90deg,#8b6dc6,#ff4d6d)",
            boxShadow: "0 0 14px rgba(89,199,255,0.35)",
            cursor: locked ? "not-allowed" : "pointer",
            opacity: locked ? 0.4 : 1,
          }}
        >
          PLACE {side === "buy" ? "BUY" : "SELL"}
        </button>

        {locked && (
          <div style={{ width: "100%", color: "#91a8d1", fontSize: 11 }}>
            Trading is available only to members who won a 1,000 USDC draw.
          </div>
        )}
        {message && <div style={{ width: "100%", color: "#ff8fa3", fontSize: 11 }}>{message}</div>}
      </div>
    </main>
  );
}