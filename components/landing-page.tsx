'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SmokeBackground } from '@/components/ui/spooky-smoke-animation';
import { AdvancedButton } from '@/components/ui/gradient-button';
import { ShinyButton } from '@/components/ui/shiny-button';
import {
  ArrowRight, CheckCircle2, BarChart3, Globe, MessageSquare,
  FileText, Calendar, Zap, Menu, X,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'sec-hero', label: 'Hero' },
  { id: 'sec-dash', label: 'Dashboard' },
  { id: 'sec-scan', label: 'AI Scan' },
  { id: 'sec-split', label: 'Split' },
  { id: 'sec-offline', label: 'Offline' },
  { id: 'sec-map', label: 'Map' },
  { id: 'sec-features', label: 'Features' },
  { id: 'sec-cta', label: 'CTA' },
];

const FEATURES = [
  { icon: BarChart3, title: 'Rich analytics', desc: 'Beautiful charts that reveal spending patterns at a glance — by category, place, time, or person.' },
  { icon: Globe, title: 'Any currency', desc: 'Track rupees, euros, pesos — 20 supported currencies with live exchange rates and per-transaction conversion.' },
  { icon: MessageSquare, title: 'Recurring detection', desc: 'Novira spots subscriptions and recurring bills automatically, so your monthly picture is always accurate.' },
  { icon: Calendar, title: 'Smart budgets', desc: 'Set monthly allowances per bucket. Get nudged before you overspend — not after your card declines.' },
  { icon: Zap, title: 'Bank imports', desc: 'Drop an HDFC or SBI statement and Novira parses it in seconds — smart duplicate detection included.' },
  { icon: FileText, title: 'Clean exports', desc: 'CSV and PDF reports that your accountant, your tax software, and your future self will thank you for.' },
];

const TXNS = [
  { name: 'Zara', sub: 'Fashion · 2m ago', amt: '−₹2,340', bg: 'rgba(236,72,153,0.1)', bc: 'rgba(236,72,153,0.3)', ic: '#F472B6' },
  { name: 'Blue Tokai', sub: 'Food · 1h ago', amt: '−₹380', bg: 'rgba(251,191,36,0.1)', bc: 'rgba(251,191,36,0.3)', ic: '#FBBF24' },
  { name: 'Uber', sub: 'Transport · 3h ago', amt: '−₹156', bg: 'rgba(34,211,238,0.1)', bc: 'rgba(34,211,238,0.3)', ic: '#22D3EE' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } },
});

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8A2BE2', boxShadow: '0 0 10px #8A2BE2', flexShrink: 0 }} />
      {children}
    </div>
  );
}

// ─── Section Dots ────────────────────────────────────────────────────────────

function SectionDots({ active }: { active: number }) {
  return (
    <div className="fixed right-7 top-1/2 -translate-y-1/2 z-[45] hidden lg:flex flex-col gap-2.5">
      {SECTIONS.map(({ id, label }, i) => (
        <button
          key={id}
          aria-label={label}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
          style={{
            width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
            transition: 'all 0.3s',
            background: active === i ? '#C084FC' : 'rgba(255,255,255,0.2)',
            boxShadow: active === i ? '0 0 12px #C084FC' : 'none',
            transform: active === i ? 'scale(1.4)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Phone Mockup (Hero) ─────────────────────────────────────────────────────

function PhoneScreen() {
  return (
    <div style={{ position: 'absolute', inset: 8, borderRadius: 36, background: 'linear-gradient(180deg, #14082b 0%, #0a0018 100%)', padding: '46px 18px 18px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Good morning,</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Raghul</div>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7B39FC, #C084FC)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>S</div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #4A0E8F 0%, #8A2BE2 50%, #EC4899 100%)', borderRadius: 18, padding: '14px 16px', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(138,43,226,0.4)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.25), transparent 60%)' }} />
        <div style={{ position: 'relative', fontSize: 10, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>Available this month</div>
        <div style={{ position: 'relative', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>₹11,580</div>
        <div style={{ position: 'relative', marginTop: 6, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: 999 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
          12% under pace
        </div>
      </div>
      <div style={{ marginTop: -14, marginLeft: -18, marginRight: -18 }}>
        <svg viewBox="0 0 300 60" style={{ width: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="sf" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#A855F7" stopOpacity="0.4"/>
              <stop offset="1" stopColor="#A855F7" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0 44 C 30 38, 45 50, 70 45 S 110 30, 140 34 S 180 20, 210 26 S 250 12, 300 8 L 300 60 L 0 60 Z" fill="url(#sf)"/>
          <path d="M0 44 C 30 38, 45 50, 70 45 S 110 30, 140 34 S 180 20, 210 26 S 250 12, 300 8" stroke="#C084FC" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>Recent</span>
        <span style={{ fontSize: 10, color: '#C084FC', fontWeight: 600 }}>See all</span>
      </div>
      {TXNS.map(tx => (
        <div key={tx.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: tx.bg, border: `1px solid ${tx.bc}` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={tx.ic} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{tx.sub}</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f87171', flexShrink: 0 }}>{tx.amt}</div>
        </div>
      ))}
    </div>
  );
}

function PhoneMockup() {
  const orbitCards = [
    { pos: { top: '8%', left: '-8%' }, anim: 'orbA 7s ease-in-out infinite', bg: 'linear-gradient(135deg, #7B39FC, #C084FC)', label: 'D', text: <>Daniel owes you <b>₹840</b></> },
    { pos: { top: '28%', right: '-16%' }, anim: 'orbB 8s ease-in-out infinite', bg: 'linear-gradient(135deg, #34d399, #10b981)', label: '✓', text: <>Synced <b>12 txns</b></> },
    { pos: { bottom: '24%', left: '-14%' }, anim: 'orbC 9s ease-in-out infinite', bg: 'linear-gradient(135deg, #EC4899, #F472B6)', label: '₹', text: <>Categorized <b>Groceries</b></> },
    { pos: { bottom: '6%', right: '-8%' }, anim: 'orbD 7.5s ease-in-out infinite', bg: 'linear-gradient(135deg, #FBBF24, #F59E0B)', label: '!', text: <>Budget on track — <b>62%</b></> },
  ];
  return (
    <div style={{ position: 'relative', height: 620, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: '10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(138,43,226,0.15) 40%, transparent 70%)', filter: 'blur(40px)', zIndex: 0, animation: 'haloPulse 5s ease-in-out infinite' }} />
      <div style={{
        width: 300, height: 600, borderRadius: 44, position: 'relative', zIndex: 2,
        background: 'linear-gradient(155deg, #2a1554 0%, #14082b 50%, #0a0018 100%)',
        border: '1px solid rgba(164,132,215,0.4)',
        boxShadow: '0 0 0 8px rgba(20,10,40,0.95), 0 0 0 9px rgba(168,85,247,0.3), 0 60px 120px -20px rgba(123,57,252,0.5), 0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        overflow: 'hidden', animation: 'phoneFloat 8s ease-in-out infinite',
      }}>
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 46, pointerEvents: 'none', opacity: 0.5,
          background: 'conic-gradient(from 180deg, transparent 0deg, rgba(168,85,247,0.6) 90deg, transparent 180deg, rgba(236,72,153,0.5) 270deg, transparent 360deg)',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor' as React.CSSProperties['WebkitMaskComposite'],
          maskComposite: 'exclude' as React.CSSProperties['maskComposite'],
          padding: 1, animation: 'spin 10s linear infinite',
        }} />
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 96, height: 26, background: '#000', borderRadius: 999, zIndex: 5 }} />
        <PhoneScreen />
      </div>
      {orbitCards.map((card, i) => (
        <div key={i} style={{
          position: 'absolute', ...card.pos as React.CSSProperties, zIndex: 3,
          animation: card.anim, padding: '10px 13px', borderRadius: 14,
          background: 'rgba(20,10,40,0.92)', border: '1px solid rgba(164,132,215,0.5)',
          backdropFilter: 'blur(18px)', boxShadow: '0 14px 36px rgba(0,0,0,0.5), 0 0 20px rgba(138,43,226,0.15)',
          display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', color: '#fff',
        }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: card.bg, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{card.label}</div>
          <span>{card.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Device Frame ───────────────────────────────────────────────────

function DeviceFrame({ tiltRef }: { tiltRef: React.RefObject<HTMLDivElement | null> }) {
  const cats = [
    { label: 'Food & Dining', val: '₹7,820', color: '#9333EA', pct: 42 },
    { label: 'Transport', val: '₹5,240', color: '#06B6D4', pct: 28 },
    { label: 'Shopping', val: '₹3,360', color: '#F472B6', pct: 18 },
    { label: 'Others', val: '₹2,000', color: '#FBBF24', pct: 11 },
  ];
  const card: React.CSSProperties = {
    background: 'rgba(20,10,40,0.78)', border: '1px solid rgba(164,132,215,0.22)',
    backdropFilter: 'blur(18px)', borderRadius: 16, padding: 14,
    boxShadow: '0 0 20px rgba(123,57,252,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
  };
  const h5: React.CSSProperties = { margin: '0 0 10px', fontSize: 10.5, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 };
  return (
    <div ref={tiltRef} id="deviceWrap" style={{
      margin: '0 auto', maxWidth: 1080, width: '100%', position: 'relative',
      transform: 'perspective(1800px) rotateX(16deg) scale(0.94)',
      transformOrigin: 'center top', transition: 'transform 0.06s linear',
    }}>
      <div style={{
        position: 'relative', borderRadius: 28,
        background: 'linear-gradient(180deg, rgba(28,14,55,0.92), rgba(14,6,30,0.94))',
        border: '1px solid rgba(164,132,215,0.35)', padding: 16,
        boxShadow: '0 40px 120px -20px rgba(123,57,252,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 80px 160px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}>
        {/* spinning conic border */}
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 30, pointerEvents: 'none',
          background: 'conic-gradient(from 180deg, rgba(168,85,247,0) 0deg, rgba(168,85,247,0.45) 90deg, rgba(168,85,247,0) 180deg, rgba(168,85,247,0.45) 270deg, rgba(168,85,247,0) 360deg)',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor' as React.CSSProperties['WebkitMaskComposite'],
          maskComposite: 'exclude' as React.CSSProperties['maskComposite'],
          padding: 1, opacity: 0.6, animation: 'spin 14s linear infinite',
        }} />
        {/* chrome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />)}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.48)', margin: '0 auto', padding: '3px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>novira.app/dashboard</span>
          <span style={{ width: 34 }} />
        </div>
        {/* dashboard layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.6fr', gap: 14, padding: 14, minHeight: 420 }}>
          {/* Left: Spending Plan */}
          <div style={card}>
            <p style={h5}>Spending Plan</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>Available this month</p>
            <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 0' }}>₹11,580</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0 10px' }}>
              <div style={{ width: 104, height: 104, position: 'relative' }}>
                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.2"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8A2BE2" strokeWidth="3.2" strokeDasharray="62 38" strokeLinecap="round"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EC4899" strokeWidth="3.2" strokeDasharray="20 80" strokeDashoffset="-62" strokeLinecap="round"/>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800 }}>62%</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['#8A2BE2','Spent','₹18,420'],['#EC4899','Planned','₹6,000'],['rgba(255,255,255,0.25)','Available','₹11,580']].map(([c,l,v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{l}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Pace sparkline */}
            <div style={card}>
              <p style={h5}>This Month's Pace</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>₹18,420</div>
                <div style={{ fontSize: 10.5, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(52,211,153,0.1)', padding: '3px 7px', borderRadius: 999, fontWeight: 600 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
                  12% under budget
                </div>
              </div>
              <svg viewBox="0 0 300 72" style={{ width: '100%', marginTop: 6 }}>
                <defs>
                  <linearGradient id="rf" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#A855F7" stopOpacity="0.45"/>
                    <stop offset="1" stopColor="#A855F7" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0 54 C 30 48, 45 60, 70 55 S 110 40, 140 44 S 180 30, 210 36 S 250 22, 300 18 L 300 72 L 0 72 Z" fill="url(#rf)"/>
                <path d="M0 54 C 30 48, 45 60, 70 55 S 110 40, 140 44 S 180 30, 210 36 S 250 22, 300 18" stroke="#C084FC" strokeWidth="1.75" fill="none" strokeLinecap="round"/>
                <circle cx="300" cy="18" r="3.5" fill="#fff" stroke="#A855F7" strokeWidth="2"/>
              </svg>
            </div>
            {/* Category bars */}
            <div style={card}>
              <p style={h5}>By Category</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cats.map((c, i) => (
                  <div key={c.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      <span>{c.label}</span><span>{c.val}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                      <span className="landing-bar-grow" style={{ display: 'block', height: '100%', borderRadius: 99, background: c.color, width: `${c.pct}%`, animationDelay: `${i * 0.1}s` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Recent transactions */}
            <div style={card}>
              <p style={h5}>Recent Transactions</p>
              {TXNS.map(tx => (
                <div key={tx.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: tx.bg, border: `1px solid ${tx.bc}` }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={tx.ic} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.name}</div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', marginTop: 2, whiteSpace: 'nowrap' }}>{tx.sub}</div>
                  </div>
                  <div style={{ flexShrink: 0, fontWeight: 700, fontSize: 13, color: '#f87171', whiteSpace: 'nowrap' }}>{tx.amt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scan Visual ──────────────────────────────────────────────────────────────

function ScanVisual() {
  const items = [
    ['Milk 1L', '₹62'], ['Bread', '₹145'], ['Coffee 500g', '₹389'],
    ['Apples 1kg', '₹88'], ['Yogurt', '₹54'], ['Bananas', '₹46'],
    ['Pasta', '₹92'], ['Cheese', '₹212'],
  ];
  return (
    <div style={{ aspectRatio: '4/3.3', borderRadius: 24, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(28,14,55,0.9), rgba(14,6,30,0.95))', border: '1px solid rgba(164,132,215,0.5)', boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div style={{ position: 'absolute', inset: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* receipt */}
        <div style={{
          width: 220, background: '#fefdf7', color: '#1a1a1a', padding: '20px 18px',
          fontFamily: 'var(--font-mono)', fontSize: 11, animation: 'receiptFloat 5s ease-in-out infinite',
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), 92% 100%, 84% calc(100% - 10px), 76% 100%, 68% calc(100% - 10px), 60% 100%, 52% calc(100% - 10px), 44% 100%, 36% calc(100% - 10px), 28% 100%, 20% calc(100% - 10px), 12% 100%, 4% calc(100% - 10px), 0 100%)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, letterSpacing: '0.05em' }}>REWE</div>
          {items.map(([n, p]) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dashed rgba(0,0,0,0.15)' }}>
              <span>{n}</span><span>{p}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 8, fontSize: 12 }}>
            <span>TOTAL</span><span>₹1,088</span>
          </div>
        </div>
      </div>
      {/* laser */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div className="scan-laser-beam" />
      </div>
      {/* result card */}
      <div style={{ position: 'absolute', right: 30, bottom: 30, padding: '12px 14px', borderRadius: 14, background: 'rgba(20,10,40,0.94)', border: '1px solid rgba(164,132,215,0.5)', backdropFilter: 'blur(14px)', fontSize: 11, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'popIn 0.6s cubic-bezier(0.34,1.5,0.64,1) 0.8s both', color: '#fff' }}>
        {[['Amount','₹1,088'],['Merchant','REWE'],['Category','Groceries']].map(([l,v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, padding: '3px 0', color: 'rgba(255,255,255,0.7)' }}>
            <span>{l}</span><b style={{ color: '#fff', fontWeight: 600 }}>{v}</b>
          </div>
        ))}
        <div style={{ color: '#34d399', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
          Form pre-filled
        </div>
      </div>
    </div>
  );
}

// ─── Split Visual ─────────────────────────────────────────────────────────────

function SplitVisual() {
  const avatars = [
    { l: 'R', bg: 'linear-gradient(135deg, #F472B6, #EC4899)' },
    { l: 'A', bg: 'linear-gradient(135deg, #7B39FC, #C084FC)' },
    { l: 'K', bg: 'linear-gradient(135deg, #06B6D4, #22D3EE)' },
    { l: '+2', bg: 'rgba(255,255,255,0.08)' },
  ];
  return (
    <div style={{ aspectRatio: '4/3.3', borderRadius: 24, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(28,14,55,0.9), rgba(14,6,30,0.95))', border: '1px solid rgba(164,132,215,0.5)', boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      {/* orbit rings */}
      <div style={{ position: 'absolute', border: '1px dashed rgba(168,85,247,0.3)', borderRadius: '50%', width: '80%', aspectRatio: '1', left: '10%', top: '50%', transform: 'translateY(-50%)', animation: 'spin 30s linear infinite' }}>
        <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#F472B6', boxShadow: '0 0 16px #F472B6', top: 0, left: '50%', marginLeft: -7, marginTop: -7 }} />
      </div>
      <div style={{ position: 'absolute', border: '1px dashed rgba(168,85,247,0.3)', borderRadius: '50%', width: '55%', aspectRatio: '1', left: '22.5%', top: '50%', transform: 'translateY(-50%)', animation: 'spin 20s linear infinite reverse' }}>
        <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#22D3EE', boxShadow: '0 0 16px #22D3EE', top: 0, left: '50%', marginLeft: -7, marginTop: -7 }} />
      </div>
      {/* bill card */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 240, padding: '16px 18px', borderRadius: 16, background: 'rgba(20,10,40,0.92)', border: '1px solid rgba(164,132,215,0.5)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 2, position: 'relative' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Dinner at Prego</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em' }}>₹4,200</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>3 people · split evenly</div>
          <div style={{ display: 'flex', marginTop: 14 }}>
            {avatars.map(({ l, bg }, i) => (
              <div key={i} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #14082b', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, background: bg, marginLeft: i > 0 ? -8 : 0 }}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Offline Visual ───────────────────────────────────────────────────────────

function OfflineVisual() {
  const queuedTxns = [
    { name: 'Café Roma', amt: '−₹420', status: 'queued' },
    { name: 'AutoRickshaw', amt: '−₹85', status: 'queued' },
    { name: 'DMart', amt: '−₹1,240', status: 'queued' },
  ];
  const syncedTxns = [
    { name: 'Café Roma', amt: '−₹420', status: 'synced' },
    { name: 'AutoRickshaw', amt: '−₹85', status: 'synced' },
    { name: 'DMart', amt: '−₹1,240', status: 'synced' },
  ];
  const panelStyle: React.CSSProperties = {
    flex: 1, borderRadius: 16, padding: 16,
    background: 'rgba(20,10,40,0.92)', border: '1px solid rgba(164,132,215,0.4)',
    backdropFilter: 'blur(14px)',
  };
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(164,132,215,0.5)', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', position: 'relative', display: 'flex', background: 'linear-gradient(180deg, rgba(28,14,55,0.9), rgba(14,6,30,0.95))' }}>
      {/* Offline panel */}
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ ...panelStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#F97316' }}>Offline — 3 queued</span>
          </div>
          {queuedTxns.map(tx => (
            <div key={tx.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{tx.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#f87171' }}>{tx.amt}</span>
                <span style={{ fontSize: 10, color: '#F97316', background: 'rgba(249,115,22,0.15)', padding: '2px 6px', borderRadius: 4 }}>pending</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Divider */}
      <div style={{ width: 2, background: 'rgba(168,85,247,0.6)', boxShadow: '0 0 20px rgba(168,85,247,0.6)', animation: 'haloPulse 2.5s ease-in-out infinite', flexShrink: 0 }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 40, borderRadius: '50%', background: '#8A2BE2', boxShadow: '0 0 0 6px rgba(138,43,226,0.3), 0 10px 30px rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 5 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
          <path d="M8 5 3 12l5 7M16 5l5 7-5 7"/>
        </svg>
      </div>
      {/* Synced panel */}
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ ...panelStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>Synced — all good</span>
          </div>
          {syncedTxns.map(tx => (
            <div key={tx.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{tx.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#f87171' }}>{tx.amt}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Map Visual ───────────────────────────────────────────────────────────────

function MapVisual() {
  const pins = [
    { cls: { top: '22%', left: '22%' }, bg: '#8A2BE2', delay: '0s' },
    { cls: { top: '55%', left: '55%' }, bg: '#EC4899', delay: '-1s' },
    { cls: { top: '35%', left: '72%' }, bg: '#06B6D4', delay: '-0.5s' },
    { cls: { top: '70%', left: '28%' }, bg: '#34d399', delay: '-1.5s' },
  ];
  return (
    <div style={{ aspectRatio: '4/3.3', borderRadius: 24, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(28,14,55,0.9), rgba(14,6,30,0.95))', border: '1px solid rgba(164,132,215,0.5)', boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(168,85,247,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.1) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 20%, transparent 75%)',
        maskImage: 'radial-gradient(circle at 50% 50%, #000 20%, transparent 75%)',
        animation: 'gridShift 20s linear infinite',
      }} />
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }} viewBox="0 0 400 300" preserveAspectRatio="none">
        <path d="M90 66 Q 180 30, 220 165 T 290 105" stroke="rgba(168,85,247,0.4)" strokeWidth="2" fill="none" strokeDasharray="4 6" style={{ animation: 'dashFlow 2s linear infinite' }}/>
        <path d="M220 165 Q 160 210, 112 210" stroke="rgba(168,85,247,0.4)" strokeWidth="2" fill="none" strokeDasharray="4 6" style={{ animation: 'dashFlow 2s linear infinite' }}/>
      </svg>
      {pins.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', ...p.cls as React.CSSProperties,
          width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: p.bg, border: '2px solid #fff',
          animation: `pinPulse 2s ease-out infinite ${p.delay}`,
          zIndex: 2,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, strokeWidth: 2.5 }}>
            <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
          </svg>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LandingPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const deviceRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Section dot tracking — root is the scroll container, not window
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.4) {
          const idx = SECTIONS.findIndex(s => s.id === e.target.id);
          if (idx !== -1) setActiveSection(idx);
        }
      }
    }, { threshold: 0.4, root: container });
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Device frame tilt — listen to the scroll container, not window
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => {
      const el = deviceRef.current;
      const sec = document.getElementById('sec-dash');
      if (!el || !sec) return;
      const r = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const t = Math.max(0, Math.min(1, 1 - (r.top + r.height * 0.5) / vh + 0.1));
      const rx = (1 - t) * 18;
      const sc = 0.9 + t * 0.08;
      el.style.transform = `perspective(1800px) rotateX(${rx}deg) scale(${sc})`;
    };
    container.addEventListener('scroll', update, { passive: true });
    update();
    return () => container.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [menuOpen]);

  const snapSection: React.CSSProperties = {
    minHeight: '100vh', scrollSnapAlign: 'start', scrollSnapStop: 'always',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '88px 28px 48px', position: 'relative',
  };

  return (
    <div
      ref={scrollRef}
      className="text-white"
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'scroll',
        overscrollBehavior: 'none',
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
      }}
    >

      {/* ── Background ─────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#0c081e' }}>
        <SmokeBackground smokeColor="#8A2BE2" />
      </div>
      {/* overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 50% 20%, rgba(12,8,30,0) 0%, rgba(10,0,24,0.55) 100%), linear-gradient(180deg, rgba(10,0,24,0.35), rgba(10,0,24,0.8))', mixBlendMode: 'multiply' }} />
      {/* grain */}
      <div className="fixed inset-0 z-[2] pointer-events-none" style={{ opacity: 0.07, mixBlendMode: 'overlay', backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.85'/></svg>\")" }} />

      {/* ── Fixed Nav ───────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50" style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'rgba(12,8,30,0.45)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-[1200px] mx-auto px-7 flex items-center justify-between gap-6" style={{ padding: '14px 28px' }}>
          <div className="flex items-center gap-2.5" style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
            <Image src="/Novira.png" alt="Novira" width={30} height={30} style={{ filter: 'drop-shadow(0 0 10px rgba(138,43,226,0.7))' }} />
            <span>Novira</span>
          </div>
          <nav className="hidden md:flex gap-[26px]" style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: 500 }}>
            {[['sec-dash','Dashboard'],['sec-scan','AI Scan'],['sec-split','Split'],['sec-offline','Offline'],['sec-features','Features']].map(([id, label]) => (
              <a key={label} href={`#${id}`}
                onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}
                className="hover:text-white transition-colors whitespace-nowrap cursor-pointer">{label}</a>
            ))}
            <Link href="/guide" className="hover:text-white transition-colors whitespace-nowrap">Guide</Link>
          </nav>
          <div className="hidden md:flex items-center gap-2.5">
            <ShinyButton href="/signin" size="sm">Sign In</ShinyButton>
            <AdvancedButton href="/signup" size="small">Get Started</AdvancedButton>
          </div>
          <button
            className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Section Dots ────────────────────────────────────────── */}
      <SectionDots active={activeSection} />

      {/* ── Mobile full-screen menu ──────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: '#0c081e' }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-6 py-[14px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2.5" style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
                <Image src="/Novira.png" alt="Novira" width={28} height={28} style={{ filter: 'drop-shadow(0 0 8px rgba(138,43,226,0.6))' }} />
                <span>Novira</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-xl hover:bg-white/10 transition-colors" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 flex flex-col justify-center px-8 gap-0.5">
              {([['sec-hero','Home'],['sec-dash','Dashboard'],['sec-scan','AI Scan'],['sec-split','Split'],['sec-offline','Offline'],['sec-features','Features']] as [string,string][]).map(([id, label], i) => (
                <motion.a
                  key={id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  href={`#${id}`}
                  onClick={e => {
                    e.preventDefault();
                    setMenuOpen(false);
                    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 150);
                  }}
                  className="text-[30px] font-bold py-2.5 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  {label}
                </motion.a>
              ))}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 + 6 * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href="/guide"
                  onClick={() => setMenuOpen(false)}
                  className="text-[30px] font-bold py-2.5 text-white/60 hover:text-white transition-colors cursor-pointer block"
                >
                  Guide
                </Link>
              </motion.div>
            </nav>

            {/* CTAs */}
            <div className="px-8 pb-14 flex flex-col gap-3">
              <AdvancedButton href="/signup" size="large">
                Get started free <ArrowRight className="w-4 h-4" />
              </AdvancedButton>
              <ShinyButton href="/signin">Sign in</ShinyButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed Footer ────────────────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-7 py-3.5 pointer-events-none">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center gap-5 flex-wrap pointer-events-auto" style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)' }}>
          <div className="flex items-center gap-2">
            <Image src="/Novira.png" alt="Novira" width={14} height={14} style={{ opacity: 0.6 }} />
            <span>© 2026 Novira</span>
          </div>
          <div className="flex gap-5">
            {[['Guide','/guide'],['Privacy','/privacy'],['Terms','/terms'],['Support','mailto:ragava22005@gmail.com']].map(([l, h]) => (
              <Link key={l} href={h} className="hover:text-white/80 transition-colors">{l}</Link>
            ))}
          </div>
        </div>
      </footer>

      <main style={{ position: 'relative', zIndex: 3 }}>

        {/* ── 1. HERO ─────────────────────────────────────────── */}
        <section id="sec-hero" style={snapSection}>
          <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 56, alignItems: 'center' }} className="hero-grid-cols">
              {/* Left */}
              <div>
                <motion.div initial="hidden" animate="visible" variants={fadeUp(0.1)}
                  className="inline-flex items-center gap-2.5 px-3 py-[7px] rounded-full text-[12.5px]"
                  style={{ background: 'rgba(85,80,110,0.4)', border: '1px solid rgba(164,132,215,0.5)', backdropFilter: 'blur(14px)', boxShadow: '0 0 20px rgba(123,57,252,0.15), inset 0 1px 0 rgba(255,255,255,0.08)', marginBottom: 22, whiteSpace: 'nowrap' }}>
                  <span style={{ background: '#8A2BE2', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: '0 0 8px rgba(123,57,252,0.4)' }}>New</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>AI receipt scanning — live now</span>
                </motion.div>

                <motion.h1 initial="hidden" animate="visible" variants={fadeUp(0.2)}
                  style={{ fontSize: 'clamp(44px, 6.2vw, 86px)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 800, margin: '0 0 20px', maxWidth: 620 }}>
                  Smarter finance,<br />
                  <span className="landing-grad-text">beautifully simple.</span>
                </motion.h1>

                <motion.p initial="hidden" animate="visible" variants={fadeUp(0.3)}
                  style={{ fontSize: 'clamp(15px, 1.3vw, 17px)', color: 'rgba(255,255,255,0.78)', maxWidth: 480, margin: '0 0 28px', lineHeight: 1.55 }}>
                  Track spending, split with friends, and understand your money — in one quietly brilliant app that works anywhere, even offline.
                </motion.p>

                <motion.div initial="hidden" animate="visible" variants={fadeUp(0.4)} className="flex flex-wrap items-center gap-2.5">
                  <AdvancedButton href="/signup" size="large">
                    Get started free <ArrowRight className="w-3.5 h-3.5" />
                  </AdvancedButton>
                  <Link
                    href="/guide"
                    className="group inline-flex items-center gap-1.5 px-4 py-3 text-[14px] font-medium transition-colors"
                    style={{ color: 'rgba(255,255,255,0.78)' }}
                  >
                    Read the guide
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>

                <motion.div initial="hidden" animate="visible" variants={fadeUp(0.5)} className="flex items-center gap-[22px] mt-7 flex-wrap"
                  style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {['No credit card', 'Free to start', 'Works offline'].map(label => (
                    <span key={label} className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.78)' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399', flexShrink: 0 }} />
                      {label}
                    </span>
                  ))}
                </motion.div>

                <motion.div initial="hidden" animate="visible" variants={fadeUp(0.5)} className="flex gap-7 mt-9 pt-7" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {[['20','Currencies'],['< 2s','Scan time']].map(([n,l]) => (
                    <div key={l}>
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                        {n.replace(/[+s★]/g,'')}<span style={{ color: '#C084FC' }}>{n.match(/[+s★]/)?.[0]}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Right: phone */}
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22,1,0.36,1] }}
                className="hidden lg:block" style={{ overflow: 'visible' }}>
                <PhoneMockup />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── 2. DASHBOARD ────────────────────────────────────── */}
        <section id="sec-dash" style={{ ...snapSection, flexDirection: 'column', justifyContent: 'center', gap: 48 }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}
            className="text-center" style={{ maxWidth: 820 }}>
            <Tag>Your dashboard</Tag>
            <h2 style={{ fontSize: 'clamp(34px, 5.5vw, 64px)', lineHeight: 1.03, letterSpacing: '-0.03em', fontWeight: 700, margin: '16px 0 0' }}>Every rupee,<br />accounted for.</h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 'clamp(15px, 1.4vw, 17px)', lineHeight: 1.55, margin: '14px auto 0', maxWidth: 560 }}>One screen. Your balance, your pace, your top categories, your latest moves — all live, all the time.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.3)}
            style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
            <DeviceFrame tiltRef={deviceRef} />
          </motion.div>
        </section>

        {/* ── 3. SCAN ──────────────────────────────────────────── */}
        <section id="sec-scan" style={snapSection}>
          <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="two-col-grid">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}>
              <Tag>AI receipt scanning</Tag>
              <h3 style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.025em', fontWeight: 700, margin: '14px 0 18px' }}>
                Point. Snap.<br /><span className="landing-grad-text">Form fills itself.</span>
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 1.6, maxWidth: 480 }}>
                Point your camera at any receipt and Novira extracts the amount, merchant, date, category, even the store address — instantly. No typing. No copy-paste. Just tap save and move on.
              </p>
              <div style={{ marginTop: 24 }}>
                <AdvancedButton href="/signup">
                  Try it free <ArrowRight className="w-4 h-4" />
                </AdvancedButton>
              </div>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.3)}>
              <ScanVisual />
            </motion.div>
          </div>
        </section>

        {/* ── 4. SPLIT ─────────────────────────────────────────── */}
        <section id="sec-split" style={snapSection}>
          <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="two-col-grid">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}>
              <SplitVisual />
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.3)}>
              <Tag>Split with friends</Tag>
              <h3 style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.025em', fontWeight: 700, margin: '14px 0 18px' }}>
                Settle up.<br /><span className="landing-grad-text">Stay friends.</span>
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 1.6, maxWidth: 480 }}>
                Groups for trips, homes, couples, or just hanging out. Split bills evenly or by custom amounts. Novira keeps running balances and suggests the fewest settlements to zero everything out.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── 5. OFFLINE ──────────────────────────────────────── */}
        <section id="sec-offline" style={{ ...snapSection, flexDirection: 'column', gap: 40 }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}
            className="text-center" style={{ maxWidth: 820 }}>
            <Tag>Works anywhere</Tag>
            <h2 style={{ fontSize: 'clamp(34px, 5.5vw, 64px)', lineHeight: 1.03, letterSpacing: '-0.03em', fontWeight: 700, margin: '16px 0 0' }}>Offline?<br /><span className="landing-grad-text">Still on.</span></h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 'clamp(15px, 1.4vw, 17px)', lineHeight: 1.55, margin: '14px auto 0', maxWidth: 560 }}>Add expenses on a plane, in a tunnel, at a mountain café with one bar. Novira saves everything locally and syncs the moment you're back — no data lost, no duplicates, no drama.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.3)} style={{ width: '100%', maxWidth: 1200, padding: '0 28px' }}>
            <OfflineVisual />
          </motion.div>
        </section>

        {/* ── 6. MAP ───────────────────────────────────────────── */}
        <section id="sec-map" style={snapSection}>
          <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="two-col-grid">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}>
              <MapVisual />
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.3)}>
              <Tag>Location-aware</Tag>
              <h3 style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.025em', fontWeight: 700, margin: '14px 0 18px' }}>
                Where your<br /><span className="landing-grad-text">money goes.</span>
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 1.6, maxWidth: 480 }}>
                Every transaction is pinned to a place. Look back on a trip and see the whole map of cafés, bars, and rides instead of a wall of numbers. Your spending, mapped.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── 7. FEATURES ─────────────────────────────────────── */}
        <section id="sec-features" style={{ ...snapSection, flexDirection: 'column', gap: 40 }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}
            className="text-center" style={{ maxWidth: 820 }}>
            <Tag>Everything else</Tag>
            <h2 style={{ fontSize: 'clamp(34px, 5.5vw, 64px)', lineHeight: 1.03, letterSpacing: '-0.03em', fontWeight: 700, margin: '16px 0 0' }}>Details, dialed in.</h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 'clamp(15px, 1.4vw, 17px)', lineHeight: 1.55, margin: '14px auto 0', maxWidth: 560 }}>Everything you need, nothing you don't. Built obsessively for people who actually care where their money goes.</p>
          </motion.div>
          <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: '0 28px' }}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(i * 0.05)}
                className="group"
                style={{ padding: 26, borderRadius: 20, border: '1px solid rgba(164,132,215,0.22)', background: 'linear-gradient(180deg, rgba(28,14,55,0.55), rgba(20,10,40,0.75))', backdropFilter: 'blur(12px)', transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)', cursor: 'default' }}
                whileHover={{ borderColor: 'rgba(164,132,215,0.4)', y: -4, boxShadow: '0 20px 50px rgba(138,43,226,0.15)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(138,43,226,0.15)', border: '1px solid rgba(138,43,226,0.3)', marginBottom: 14 }}>
                  <f.icon style={{ width: 20, height: 20, color: '#C084FC', strokeWidth: 2.2 }} />
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{f.title}</h4>
                <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 8. CTA ──────────────────────────────────────────── */}
        <section id="sec-cta" style={{ ...snapSection, paddingBottom: 80 }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp(0.1)}
            className="text-center" style={{ maxWidth: 780 }}>
            <Tag>Start free today</Tag>
            <h2 style={{ fontSize: 'clamp(42px, 7vw, 88px)', lineHeight: 0.98, letterSpacing: '-0.03em', fontWeight: 800, margin: '14px 0 22px' }}>
              Take control of<br /><span className="landing-grad-text">your money.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 17, lineHeight: 1.55, margin: '0 auto 32px', maxWidth: 520 }}>
              Create a free account in 30 seconds. No credit card, no commitment, no nonsense.
            </p>
            <div className="flex items-center justify-center gap-3">
              <AdvancedButton href="/signup" size="large">
                Create free account <ArrowRight className="w-4 h-4" />
              </AdvancedButton>
              <ShinyButton href="/signin">Sign in</ShinyButton>
            </div>
          </motion.div>
        </section>

      </main>

      {/* ── Responsive overrides ────────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .hero-grid-cols { grid-template-columns: 1fr !important; text-align: center; }
          .two-col-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 768px) {
          #sec-features > div:last-child { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          section[id^="sec-"] { padding-left: 18px !important; padding-right: 18px !important; }
          .hero-grid-cols h1 { font-size: clamp(32px, 10vw, 44px) !important; line-height: 1.05 !important; }
          .hero-grid-cols p  { font-size: 15px !important; }
          .two-col-grid { gap: 24px !important; }
        }
      `}</style>
    </div>
  );
}
