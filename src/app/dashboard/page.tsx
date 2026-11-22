"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const DESIGN_W = 1781;
const DESIGN_H = 883;
const BOX_SIZE = 100;
const WINNERS_PER_MONTH = 5;
const MONTHS = 20;
const ENTRY_FEE = 52;
const CANCEL_REFUND = 50;
const CANCEL_FEE = 2;

// fixed "now" so server and client render the same mock data
const NOW = new Date(2026, 10, 22, 19, 0);

const NAMES = ["nora", "arman", "sophia", "liam", "emma", "noah", "olivia", "elijah", "mia", "lucas"];
const COLORS = ["#8b6dc6", "#547fd0", "#bd70a9", "#438ea1", "#bd7968", "#518ba8", "#718dc7", "#4b9a7d"];

type Member = {
  name: string;
  id: string;
  color: string;
  at: Date;
};

type ClosedBox = {
  id: string;
  num: number;
  start: Date;
  drawn: number;
  winnersByMonth: number[][];
};

type CurrentBox = {
  number: number;
  startedAt: Date;
  members: Member[];
};

const pad = (n: number, size = 2) => String(n).padStart(size, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const fmtMonth = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}`;
const fmtDateTime = (d: Date) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const drawDate = (start: Date, m: number) =>
  new Date(start.getFullYear(), start.getMonth() + m, start.getDate());

const memberName = (n: number) => NAMES[(n - 1) % NAMES.length];
const memberColor = (n: number) => COLORS[(n - 1) % COLORS.length];

// deterministic mock: shuffle members 1..100, then split into 20 months of 5 winners
const buildBox = (num: number, start: Date): ClosedBox => {
  let seed = num * 9973 + 17;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed;
  };
  const pool = Array.from({ length: BOX_SIZE }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rnd() % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winnersByMonth = Array.from({ length: MONTHS }, (_, m) =>
    pool.slice(m * WINNERS_PER_MONTH, (m + 1) * WINNERS_PER_MONTH)
  );
  const drawn = Array.from({ length: MONTHS }, (_, m) => m).filter(
    (m) => drawDate(start, m).getTime() <= NOW.getTime()
  ).length;
  return { id: pad(num, 3), num, start, drawn, winnersByMonth };
};

const initialBoxes: ClosedBox[] = Array.from({ length: 20 }, (_, i) =>
  buildBox(i + 1, new Date(2025, 3 + i, 8))
);

const makeMembers = (count: number): Member[] =>
  Array.from({ length: count }, (_, i) => ({
    name: NAMES[i % NAMES.length],
    id: pad(i + 1, 8),
    color: COLORS[i % COLORS.length],
    at: new Date(NOW.getTime() - i * 7 * 60 * 1000),
  })).reverse();

const abs = (
  x: number,
  y: number,
  w: number,
  h: number,
  extra: React.CSSProperties = {}
): React.CSSProperties => ({
  position: "absolute",
  left: `${x}%`,
  top: `${y}%`,
  width: `${w}%`,
  height: `${h}%`,
  ...extra,
});

const ellipse: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "99px",
  border: "1px solid rgba(139, 199, 255, 0.6)",
  background: "linear-gradient(135deg, rgba(139,109,198,0.5) 0%, rgba(84,127,208,0.5) 100%)",
  boxShadow: "0 0 14px rgba(70, 160, 255, 0.5)",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

const scrollHideCss = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Space+Mono:wght@700&display=swap');
  .hide-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  .hide-scroll::-webkit-scrollbar { display: none; }
`;

const MEMBER_COLS = "1.2fr 1.1fr 0.5fr";
const BOX_COLS = "1fr 0.8fr 1fr";
const RIGHT_PAD = 40;

function WinnerAvatar({ n, size }: { n: number; size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.55,
        fontWeight: 800,
        color: "#fff",
        background: memberColor(n),
        flexShrink: 0,
      }}
    >
      {memberName(n).charAt(0)}
    </span>
  );
}

function WinnersModal({
  box,
  month,
  onClose,
}: {
  box: ClosedBox;
  month: number;
  onClose: () => void;
}) {
  const winners = box.winnersByMonth[month] ?? [];
  const label = fmtMonth(drawDate(box.start, month));

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: "rgba(3, 7, 22, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "30%",
          padding: "22px 24px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(10,16,40,0.97), rgba(20,28,60,0.97))",
          border: "1px solid rgba(139,199,255,0.45)",
          boxShadow: "0 0 24px rgba(70,160,255,0.4)",
          color: "#fff",
          textTransform: "lowercase",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            box {box.id} · {label}
          </div>
          <div style={{ fontSize: 9, color: "#f2cf87" }}>{WINNERS_PER_MONTH} winners</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {winners.map((n) => (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(139,109,198,0.25), rgba(84,127,208,0.2))",
                border: "1px solid rgba(139,199,255,0.35)",
              }}
            >
              <WinnerAvatar n={n} size={22} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{memberName(n)}</span>
              <span style={{ fontSize: 10, color: "#aebfe0" }}>({pad(n, 8)})</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#f2cf87" }}>#{pad(n, 3)}</span>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ ...ellipse, marginTop: 16, width: "100%", padding: "8px 0", fontSize: 13 }}>
          back
        </button>
      </div>
    </div>
  );
}

function BoxDetail({ box, onClose }: { box: ClosedBox; onClose: () => void }) {
  const drawnWinners = box.winnersByMonth.slice(0, box.drawn);
  const won = new Map<number, number>();
  drawnWinners.forEach((ws, m) => ws.forEach((n) => won.set(n, m)));
  const winnerList = drawnWinners.flatMap((ws, m) => ws.map((n) => ({ n, m })));
  const ended = box.drawn >= MONTHS;
  const members = Array.from({ length: BOX_SIZE }, (_, i) => i + 1);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "rgba(3, 7, 22, 0.96)",
        color: "#fff",
        textTransform: "lowercase",
      }}
    >
      <button onClick={onClose} style={abs(2.5, 5, 7, 4, { ...ellipse, fontSize: 14 })}>
        back
      </button>

      <div style={abs(12, 4, 30, 6, { display: "flex", flexDirection: "column", justifyContent: "center" })}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>box {box.id}</div>
        <div style={{ fontSize: 9, color: "#a9bad9", marginTop: 4 }}>{fmtDate(box.start)}</div>
      </div>

      {ended && (
        <div
          style={abs(46, 3, 50, 9, {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            textAlign: "center",
          })}
        >
          <div
            style={{
              fontFamily: "'Orbitron', 'Outfit', sans-serif",
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1.1,
              textShadow: "0 0 18px rgba(139,109,198,0.8), 0 0 30px rgba(89,199,255,0.6)",
            }}
          >
            100 confirmed winners
          </div>
          <div style={{ fontSize: 11, color: "#aebfdf", marginTop: 6 }}>the end of this thrilling path</div>
        </div>
      )}

      <div style={abs(5, 18, 62, 78, { display: "flex", flexDirection: "column" })}>
        <div style={{ fontSize: 10, color: "#91a8d1", marginBottom: 8 }}>
          members · {BOX_SIZE} · won {winnerList.length}
        </div>
        <div
          className="hide-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(10, 1fr)",
            gap: 8,
            paddingRight: 4,
          }}
        >
          {members.map((n) => {
            const isWon = won.has(n);
            return (
              <div
                key={n}
                style={{
                  fontSize: 9,
                  textAlign: "center",
                  padding: "12px 0",
                  borderRadius: 6,
                  border: `1px solid ${isWon ? "rgba(147,182,239,0.06)" : "rgba(147,182,239,0.3)"}`,
                  background: isWon
                    ? "transparent"
                    : "linear-gradient(135deg, rgba(139,109,198,0.16), rgba(84,127,208,0.1))",
                  color: isWon ? "rgba(147,182,239,0.18)" : "#dce8ff",
                  boxShadow: isWon ? "none" : "0 0 8px rgba(70,160,255,0.15)",
                }}
              >
                {pad(n, 8)}
              </div>
            );
          })}
        </div>
      </div>

      <div style={abs(70, 18, 25, 78, { display: "flex", flexDirection: "column" })}>
        <div style={{ fontSize: 10, color: "#f2cf87", marginBottom: 8 }}>winners · {winnerList.length}</div>
        <div
          className="hide-scroll"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}
        >
          {winnerList.map(({ n, m }) => (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(139,109,198,0.25), rgba(84,127,208,0.2))",
                border: "1px solid rgba(139,199,255,0.35)",
                boxShadow: "0 0 12px rgba(70,160,255,0.3)",
              }}
            >
              <WinnerAvatar n={n} size={20} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{memberName(n)}</span>
              <span style={{ fontSize: 10, color: "#aebfe0" }}>({pad(n, 8)})</span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "#a9bad9" }}>
                {fmtMonth(drawDate(box.start, m))}
              </span>
              <span style={{ fontSize: 10, color: "#f2cf87" }}>#{pad(n, 3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [now, setNow] = useState<Date | null>(null);
  const [scale, setScale] = useState(1);
  const [closedBoxes, setClosedBoxes] = useState<ClosedBox[]>(initialBoxes);
  const [current, setCurrent] = useState<CurrentBox>({
    number: 21,
    startedAt: new Date(2026, 10, 21, 12, 35),
    members: makeMembers(56),
  });
  const [openBox, setOpenBox] = useState<ClosedBox | null>(null);
  const [winnerModal, setWinnerModal] = useState<{ box: ClosedBox; month: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    fit();
    window.addEventListener("resize", fit);

    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.removeEventListener("resize", fit);
      clearInterval(timer);
    };
  }, []);

  const userJoined = current.members.some((m) => m.name === "you");
  const isFull = current.members.length >= BOX_SIZE;

  // one entry per box, the box closes when it reaches 100 members
  function handleBuy() {
    if (userJoined) {
      setMessage("You already joined this box.");
      return;
    }
    if (isFull) {
      setMessage("This box is full.");
      return;
    }

    // TODO: take the 52 USDC entry fee through the contract here
    const newMember: Member = {
      name: "you",
      id: pad(current.members.length + 1, 8),
      color: "#718dc7",
      at: new Date(),
    };
    const updated = [newMember, ...current.members];

    if (updated.length === BOX_SIZE) {
      setClosedBoxes((prev) => [...prev, buildBox(current.number, current.startedAt)]);
      setCurrent({ number: current.number + 1, startedAt: new Date(), members: [] });
      setMessage(`Box ${pad(current.number, 3)} is full and closed. Draws start on its start date.`);
    } else {
      setCurrent({ ...current, members: updated });
      setMessage(`Joined box ${pad(current.number, 3)}. ${ENTRY_FEE} USDC entry recorded.`);
    }
  }

  // cancel is allowed only before the box is full: $50 back, $2 kept
  function handleCancel() {
    if (!userJoined) {
      setMessage("You are not in this box.");
      return;
    }
    if (isFull) {
      setMessage("This box is full. Cancellation is no longer possible.");
      return;
    }

    // TODO: send the refund ($50 back, $2 fee) through the contract here
    setCurrent({ ...current, members: current.members.filter((m) => m.name !== "you") });
    setMessage(`Cancelled. ${CANCEL_REFUND} USDC returned, ${CANCEL_FEE} USDC fee kept.`);
  }

  const timeText = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "--:--";
  const dateText = now ? fmtDate(now) : "----/--/--";
  const joined = current.members.length;

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#030716",
        overflow: "hidden",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <style>{scrollHideCss}</style>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center",
          backgroundImage: "url('/hero8.jpeg')",
          backgroundSize: "100% 100%",
          color: "#fff",
          textTransform: "lowercase",
        }}
      >
        <button onClick={() => window.history.back()} style={abs(2.5, 5, 7, 4, { ...ellipse, fontSize: 14 })}>
          back
        </button>

        <Link
          href="/vault"
          style={abs(12, 4, 10, 6, {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 28,
            fontWeight: 700,
            textDecoration: "none",
          })}
        >
          vault
        </Link>

        <ConnectButton.Custom>
          {({ account, mounted, openAccountModal, openConnectModal }) => {
            const connected = mounted && !!account;
            const onClick = connected ? openAccountModal : openConnectModal;
            return (
              <>
                <button
                  onClick={onClick}
                  style={abs(78.2, 4, 9.4, 5, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    boxShadow: "none",
                    padding: 0,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif",
                  })}
                >
                  sign
                </button>

                <div style={abs(90, 5, 7, 4, { ...ellipse, padding: 0, overflow: "hidden" })}>
                  <button
                    onClick={onClick}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      width: "100%",
                      height: "100%",
                      lineHeight: 1.2,
                      padding: 0,
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {connected ? account.displayName : "sign in"}
                  </button>
                </div>
              </>
            );
          }}
        </ConnectButton.Custom>

        <img src="/logo1.jpg" alt="logo" style={abs(4.5, 89, 9, 9, { objectFit: "contain" })} />

        <div
          className="hide-scroll"
          style={abs(8, 22, 27, 52, {
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            overflowX: "hidden",
            transform: "skewX(-10deg)",
            transformOrigin: "top center",
          })}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: BOX_COLS,
              gap: 8,
              fontSize: 8,
              color: "#91a8d1",
              padding: "4px 6px 3px",
              borderBottom: "1px solid rgba(147,182,239,0.12)",
              lineHeight: 1.2,
            }}
          >
            <span>started</span>
            <span style={{ textAlign: "center" }}>box</span>
            <span style={{ textAlign: "right" }}>result</span>
          </div>

          {[...closedBoxes].reverse().map((box) => (
            <div
              key={box.id}
              style={{
                display: "grid",
                gridTemplateColumns: BOX_COLS,
                gap: 8,
                alignItems: "center",
                padding: "4px 6px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: 9, color: "#a9bad9" }}>{fmtDate(box.start)}</span>
              <span
                onClick={() => setOpenBox(box)}
                style={{ fontSize: 11, fontWeight: 700, textAlign: "center", cursor: "pointer" }}
              >
                box {box.id}
              </span>
              <span
                onClick={() => box.drawn > 0 && setWinnerModal({ box, month: box.drawn - 1 })}
                style={{
                  fontSize: 9,
                  color: "#f2cf87",
                  textAlign: "right",
                  cursor: box.drawn > 0 ? "pointer" : "default",
                }}
              >
                {WINNERS_PER_MONTH} winners
              </span>
            </div>
          ))}
        </div>

        <div
          style={abs(40, 29, 20, 2.5, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "'Space Mono', 'Courier New', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1,
          })}
        >
          <span>{dateText}</span>
          <span>{timeText}</span>
        </div>

        <div
          style={abs(29, 34, 42, 6, {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "'Orbitron', 'Outfit', sans-serif",
            fontSize: 40,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "0.06em",
            background: "linear-gradient(90deg, #8b6dc6 0%, #59c7ff 50%, #ff4d6d 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 8px rgba(89, 199, 255, 0.45))",
          })}
        >
          arcquant
        </div>

        <div
          style={abs(39, 44, 22, 7, {
            textAlign: "center",
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 1,
            background: "linear-gradient(90deg, #e7c681 0%, #8bc7ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          })}
        >
          ${ENTRY_FEE}
        </div>
        <div
          style={abs(39, 52, 22, 3, {
            textAlign: "center",
            fontSize: 9,
            color: "#acc9f4",
            letterSpacing: "0.06em",
            lineHeight: 1,
          })}
        >
          usdc entry fee
        </div>

        <button
          onClick={handleCancel}
          style={abs(38.5, 57, 11.5, 5.5, {
            border: "none",
            background: "none",
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            cursor: "pointer",
            padding: 0,
          })}
        >
          cancel
        </button>
        <button
          onClick={handleBuy}
          style={abs(50.5, 57, 11.5, 5.5, {
            border: "none",
            background: "none",
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            cursor: "pointer",
            padding: 0,
          })}
        >
          buy
        </button>

        <div
          style={abs(35, 67.5, 29, 15, {
            fontSize: 19,
            lineHeight: 1.5,
            color: "#aebfdf",
            textAlign: "center",
          })}
        >
          join this box for ${ENTRY_FEE} usdc. until the box reaches {BOX_SIZE} members, you can cancel
          anytime: a ${CANCEL_FEE} fee is kept and ${CANCEL_REFUND} is returned. once the box is full and closed,
          cancellation is no longer possible.
        </div>

        {message && (
          <div
            style={abs(35, 84, 29, 4, {
              textAlign: "center",
              fontSize: 12,
              color: "#75e7c2",
              lineHeight: 1.3,
            })}
          >
            {message}
          </div>
        )}

        <div
          className="hide-scroll"
          style={abs(63, 18, 31, 55, {
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transform: "skewX(10deg)",
            transformOrigin: "top center",
            clipPath: "polygon(0% 0%, 97% 0%, 98% 100%, 0% 100%)",
          })}
        >
          <div
            style={{
              paddingBottom: 4,
              paddingLeft: 22,
              paddingRight: RIGHT_PAD,
              borderBottom: "1px solid rgba(160,194,255,0.12)",
            }}
          >
            <div style={{ fontSize: 9, color: "#9fb3d9", fontWeight: 700, lineHeight: 1.2 }}>current round</div>
            <div style={{ fontSize: 14, color: "#fff", fontWeight: 700, lineHeight: 1.2 }}>
              box {pad(current.number, 3)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              color: "#aebfdf",
              margin: "5px 0 3px",
              paddingLeft: 22,
              paddingRight: RIGHT_PAD,
              lineHeight: 1.2,
            }}
          >
            <span>members joined</span>
            <span>
              <strong>{joined}</strong> / {BOX_SIZE}
            </span>
          </div>

          <div
            style={{
              height: 3,
              marginLeft: 22,
              marginRight: RIGHT_PAD,
              background: "rgba(115,145,201,0.2)",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                width: `${(joined / BOX_SIZE) * 100}%`,
                height: "100%",
                background: "#59c7ff",
                transition: "width 0.4s ease",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: MEMBER_COLS,
              fontSize: 8,
              color: "#91a8d1",
              padding: `5px ${RIGHT_PAD}px 3px 22px`,
              borderBottom: "1px solid rgba(147,182,239,0.12)",
              lineHeight: 1.2,
            }}
          >
            <span>participant</span>
            <span>joined at</span>
            <span style={{ textAlign: "right" }}>status</span>
          </div>

          <div className="hide-scroll" style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
            {current.members.map((member) => (
              <div
                key={member.id + member.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: MEMBER_COLS,
                  alignItems: "center",
                  padding: `4px ${RIGHT_PAD}px 4px 22px`,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  lineHeight: 1.2,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e5edfc", whiteSpace: "nowrap" }}>
                    {member.name}
                  </span>
                  <span style={{ fontSize: 8, color: "#aebfe0", whiteSpace: "nowrap" }}>({member.id})</span>
                </div>

                <span style={{ fontSize: 8, color: "#aebfdf", whiteSpace: "nowrap" }}>
                  {fmtDateTime(member.at)}
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 3,
                    fontSize: 8,
                    color: "#75e7c2",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#75e7c2" }} />
                  live
                </div>
              </div>
            ))}
          </div>
        </div>

        {openBox && <BoxDetail box={openBox} onClose={() => setOpenBox(null)} />}

        {winnerModal && (
          <WinnersModal
            box={winnerModal.box}
            month={winnerModal.month}
            onClose={() => setWinnerModal(null)}
          />
        )}
      </div>
    </main>
  );
}