"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, CandlestickChart, Lock, Globe, FileText } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { AuthModal } from "@/components/auth-modal";

// one shared style for both top-right buttons so they have the same size
const pill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 26,
  minWidth: 118,
  padding: "0 12px",
  borderRadius: 99,
  border: "1px solid rgba(139, 199, 255, 0.55)",
  background: "rgba(10, 14, 35, 0.72)",
  boxShadow:
    "0 0 6px rgba(139, 109, 198, 0.55), 0 0 10px rgba(70, 160, 255, 0.45), 0 0 14px rgba(255, 77, 109, 0.3)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.03em",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "'Outfit', sans-serif",
};

const links = [
  { href: "/dashboard", label: "Enter App", Icon: Play, x: -6, y: -8 },
  { href: "/trade", label: "Trade", Icon: CandlestickChart, x: -10, y: -6 },
  { href: "/stake", label: "Stake", Icon: Lock, x: -4, y: -4 },
  { href: "/ecosystem", label: "Ecosystem", Icon: Globe, x: -8, y: -6 },
];

const iconBox: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #8b6dc6 0%, #ff4d6d 100%)",
  boxShadow: "0 0 8px rgba(139, 109, 198, 0.6), 0 0 12px rgba(255, 77, 109, 0.35)",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Rajdhani', 'Outfit', sans-serif",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "#e8ecff",
  textTransform: "uppercase",
};

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const { address } = useAccount();

  return (
    <main className="h-screen w-full flex flex-col relative overflow-hidden bg-[#030816]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Outfit:wght@400;600;700&display=swap');
      `}</style>

      {/* background */}
      <div className="absolute inset-0 z-0 bg-[#030816]">
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: "scale(0.9)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 99%, transparent 90%)",
            maskImage: "radial-gradient(ellipse at center, black 70%, transparent 78%)",
          }}
        >
          <Image
            src="/hero-bg.png"
            alt="ArcQuant Background"
            fill
            className="object-cover object-center"
            priority
            unoptimized
          />
        </div>
        <div className="absolute inset-0 bg-black/5" />
      </div>

      {/* left menu */}
      <header className="relative z-20 w-full flex flex-col items-start px-8 pt-8 gap-3 shrink-0">
        <div className="flex flex-col gap-2 mt-2">
          {links.map(({ href, label, Icon, x, y }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-white/5 transition-all"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <div style={iconBox}>
                <Icon style={{ width: 13, height: 13, color: "#ffffff" }} />
              </div>
              <span style={labelStyle}>{label}</span>
            </Link>
          ))}

          <a
            href="#"
            className="group flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-white/5 transition-all"
            style={{ transform: "translate(-6px, -6px)" }}
          >
            <div style={iconBox}>
              <FileText style={{ width: 13, height: 13, color: "#ffffff" }} />
            </div>
            <span style={labelStyle}>Read Whitepaper</span>
          </a>
        </div>
      </header>

      {/* top right: Sign In and wallet buttons, same size, side by side */}
      <div
        className="absolute z-30 flex items-center"
        style={{ top: 12, right: 4, gap: 8 }}
      >
        <ConnectButton.Custom>
          {({ account, mounted, openConnectModal, openAccountModal }) => {
            const connected = mounted && !!account;
            return (
              <>
                <button type="button" onClick={openConnectModal} style={pill}>
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={connected ? openAccountModal : openConnectModal}
                  style={pill}
                >
                  {connected ? account.displayName : "Connect Wallet"}
                </button>
              </>
            );
          }}
        </ConnectButton.Custom>
      </div>

      <AuthModal
        address={address}
        open={authOpen}
        initialMode="sign-in"
        onClose={() => setAuthOpen(false)}
        onLinked={() => setAuthOpen(false)}
      />

      {/* bottom text */}
      <div className="relative z-10 flex flex-col items-center justify-end flex-grow text-center px-4 pb-6">
        <p className="text-[10px] md:text-xs text-gray-400 max-w-md mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-tight font-light tracking-wide">
          Experience the future of decentralized group savings.
          <br />
          Win a <strong className="text-gray-200">1,000 USDC</strong> vault, protected by risk management.
        </p>
      </div>
    </main>
  );
}