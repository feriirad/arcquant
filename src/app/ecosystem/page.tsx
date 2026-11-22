"use client";

/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Ecosystem() {
  return (
    <main className="min-h-screen bg-[#030816] text-[#E2E8F0] flex flex-col font-sans">
      {/* header */}
      <header className="w-full flex justify-between items-center px-10 py-6 border-b border-[#1A2B4C]/50 shrink-0 bg-[#030816]/90 sticky top-0 z-50 backdrop-blur-md">
        <nav className="flex gap-8 font-medium">
          <Link href="/" className="hover:text-[#4DB8FF] transition">Home</Link>
          <Link href="/ecosystem" className="text-[#4DB8FF]">Ecosystem</Link>
          <Link href="/stake" className="hover:text-[#4DB8FF] transition">Stake</Link>
          <Link href="/trade" className="hover:text-[#4DB8FF] transition">Trading</Link>
        </nav>
        <ConnectButton />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16 flex-grow w-full">
        <h1 className="text-4xl md:text-6xl font-bold text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-[#E2E8F0] via-[#4DB8FF] to-[#D4AF37]">
          Let's Talk About Your Future
        </h1>

        {/* intro */}
        <div className="bg-[#0A1428] border border-[#4DB8FF]/30 rounded-2xl p-8 mb-10 shadow-[0_0_30px_rgba(77,184,255,0.1)] text-lg leading-loose text-gray-200">
          <p className="mb-6">
            You know what you're about to do, my friend? You're about to join a place where, every month, a group of people
            gets a real chance at something big, for just <strong className="text-[#4DB8FF]">$52</strong>.
          </p>
          <p className="mb-6">
            Here is how it works. You join a box of <strong className="text-white">100 members</strong>. You pay{" "}
            <strong className="text-[#4DB8FF]">$52 every month</strong>, and each month{" "}
            <strong className="text-[#D4AF37]">5 members are drawn as winners</strong>. Each winner receives a{" "}
            <strong className="text-[#D4AF37]">$1,000 trading margin</strong>.
          </p>
          <p>
            The cycle lasts <strong className="text-white">20 months</strong>. Because the draw keeps going, by month 20
            every member in the box has won.
          </p>
        </div>

        {/* joining and cancelling */}
        <div className="bg-[#0A1428] border border-[#1A2B4C] rounded-2xl p-8 mb-10 shadow-lg text-lg leading-loose text-gray-200">
          <h2 className="text-2xl font-bold text-[#4DB8FF] mb-6">Before the box fills up</h2>
          <p className="mb-6">
            Before the box reaches 100 members, you can change your mind. If you cancel, you get{" "}
            <strong className="text-white">$50 back</strong>, and <strong className="text-white">$2</strong> is kept as a
            fee. Once the box is full, it closes and cancellation is no longer possible.
          </p>
        </div>

        {/* margin and trading */}
        <div className="bg-[#0A1428] border border-[#4DB8FF]/30 rounded-2xl p-8 mb-10 shadow-lg text-lg leading-loose text-gray-200">
          <p className="mb-6">
            "But wait," you might ask, "Do I actually get to use the $1,000?" Yes. The $1,000 is your{" "}
            <strong className="text-white">trading margin</strong>. You can use it right here on ArcQuant to trade spot
            crypto.
          </p>
          <p className="mb-6">
            The margin stays locked until <strong className="text-white">month 20</strong>, and you can only claim it after
            your final installment is paid. But any <strong className="text-[#4DB8FF]">realized profit</strong> from your
            trades can be withdrawn at any time.
          </p>
          <p>
            And staking? You can stake part of your USDC for <strong className="text-white">1, 3, 6, or 12 months</strong>{" "}
            at <strong className="text-[#4DB8FF]">18% APY</strong>. Whatever you stake is locked, so it cannot be traded
            until it unlocks.
          </p>
        </div>

        {/* risk management */}
        <div className="bg-[#0A1428] border border-[#D4AF37]/30 rounded-2xl p-8 mb-10 shadow-lg text-lg leading-loose text-gray-200">
          <h2 className="text-2xl font-bold text-[#D4AF37] mb-6">Now, let's talk about risk...</h2>
          <p className="mb-6">
            Relax. Every installment you pay gives you more room to trade. Your maximum realized loss is calculated like
            this: <strong className="text-white">number of paid installments × $50</strong>.
          </p>
          <ul className="list-disc list-inside mb-6 space-y-3 ml-4">
            <li>After <strong className="text-[#4DB8FF]">1 installment</strong> ($52), your loss limit is <strong>$50</strong>.</li>
            <li>After <strong className="text-[#4DB8FF]">3 installments</strong> ($156), your loss limit is <strong>$150</strong>.</li>
            <li>
              When your realized losses reach your limit, <strong className="text-red-400">trading is locked</strong>. It
              stays locked until you pay the next month's installment.
            </li>
          </ul>
          <p>
            The day after you pay that installment, trading opens again with the same $1,000 margin and a new loss limit.
          </p>
        </div>

        {/* rules for non-winners and winners */}
        <div className="bg-[#0A1428] border border-red-500/30 rounded-2xl p-8 mb-12 shadow-lg text-lg leading-loose text-gray-200">
          <h2 className="text-2xl font-bold text-red-400 mb-6">The golden rule: keep your word</h2>
          <p className="mb-6">
            A golden opportunity needs strict rules to survive. Since real money and commitments of 100 people are involved,
            we have to be strict.
          </p>
          <ul className="list-disc list-inside mb-6 space-y-4 ml-4">
            <li>
              <strong className="text-white">Non-winners:</strong> If you are late with one installment, you get one month
              of grace. The next month, you must pay both the overdue installment and the current one at once. If you are
              late again, your account is closed. At month 20, every installment you paid is refunded to you in one payment.
            </li>
            <li>
              <strong className="text-white">Winners with your $1,000 margin:</strong> If you are late with even{" "}
              <strong>one installment</strong>, your account is blocked right away. You cannot trade and cannot withdraw
              until month 20. At month 20, we refund every installment you paid up to the day your account was blocked.
            </li>
          </ul>
          <p className="mb-4">
            At month 20, after your final installment is paid, you can claim your $1,000 margin. Any realized trading
            losses are deducted first, and you receive the rest.
          </p>
          <p className="text-[#D4AF37] font-bold text-xl mt-6">
            You heard it right, my friend. Every rule above is enforced by the smart contract, not by promises.
          </p>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/dashboard"
            className="inline-block bg-[#4DB8FF] text-[#030816] font-bold py-4 px-12 rounded-full text-lg hover:bg-white transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(77,184,255,0.4)]"
          >
            Start Your Journey
          </Link>
        </div>
      </div>
    </main>
  );
}