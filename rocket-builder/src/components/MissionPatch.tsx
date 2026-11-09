import { useEffect, useState } from 'react';

/**
 * Original retro mission patch for the game.
 *
 * NASA's insignia ("meatball") and logotype ("worm") are protected
 * (14 CFR Part 1221) and NASA Space Apps asks participants not to use them,
 * so the game ships with this original patch instead. If your team has
 * written permission to use an official mark, drop it at
 * public/branding/logo.svg (or .png) and it replaces this patch everywhere.
 */
const CANDIDATES = ['branding/logo.svg', 'branding/logo.png'];
let cached: string | null | undefined;

async function findBrandLogo(): Promise<string | null> {
  if (cached !== undefined) return cached;
  for (const path of CANDIDATES) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { method: 'HEAD' });
      const type = res.headers.get('content-type') ?? '';
      // Dev servers answer missing files with index.html, so check the type.
      if (res.ok && type.startsWith('image/')) {
        cached = `${import.meta.env.BASE_URL}${path}`;
        return cached;
      }
    } catch {
      /* offline or missing: fall through */
    }
  }
  cached = null;
  return null;
}

export function MissionPatch({ size = 64, className = '' }: { size?: number; className?: string }) {
  const [logo, setLogo] = useState<string | null>(cached ?? null);
  useEffect(() => {
    let alive = true;
    void findBrandLogo().then((l) => alive && setLogo(l));
    return () => {
      alive = false;
    };
  }, []);

  if (logo) {
    return <img src={logo} width={size} height={size} alt="Mission logo" className={className} style={{ objectFit: 'contain' }} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Exoplanet Rocket Builder mission patch"
      className={className}
    >
      <defs>
        <linearGradient id="patch-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#ff6fb5" />
          <stop offset="1" stopColor="#ff4fd8" />
        </linearGradient>
        <linearGradient id="patch-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0221" />
          <stop offset="1" stopColor="#3d1a78" />
        </linearGradient>
        <clipPath id="patch-clip">
          <circle cx="60" cy="60" r="44" />
        </clipPath>
        <path id="patch-arc-top" d="M 14 60 A 46 46 0 0 1 106 60" />
        <path id="patch-arc-bottom" d="M 18 64 A 42 42 0 0 0 102 64" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="#1a0b3d" stroke="#ff4fd8" strokeWidth="3" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="#5ee7ff" strokeWidth="1.5" strokeDasharray="2 3" />
      <g clipPath="url(#patch-clip)">
        <rect x="0" y="0" width="120" height="120" fill="url(#patch-sky)" />
        <circle cx="60" cy="78" r="26" fill="url(#patch-sun)" />
        <g fill="#0d0221">
          <rect x="30" y="74" width="60" height="2" />
          <rect x="30" y="80" width="60" height="3" />
          <rect x="30" y="87" width="60" height="4" />
        </g>
        <g stroke="#ff4fd8" strokeWidth="1" opacity="0.9">
          <line x1="16" y1="96" x2="104" y2="96" />
          <line x1="16" y1="101" x2="104" y2="101" />
          <line x1="60" y1="96" x2="60" y2="104" />
          <line x1="44" y1="96" x2="32" y2="104" />
          <line x1="76" y1="96" x2="88" y2="104" />
        </g>
        <ellipse cx="88" cy="36" rx="13" ry="4" fill="none" stroke="#5ee7ff" strokeWidth="1.5" />
        <circle cx="88" cy="36" r="7" fill="#b13bff" />
        <path d="M60 22 C67 30 69 42 66 56 H54 C51 42 53 30 60 22 Z" fill="#e9ddff" stroke="#5ee7ff" strokeWidth="1.5" />
        <circle cx="60" cy="38" r="3.5" fill="#5ee7ff" />
        <path d="M54 50 L47 60 L54 58 Z M66 50 L73 60 L66 58 Z" fill="#ff4fd8" />
        <path d="M56 57 L60 68 L64 57 Z" fill="#ffb86b" />
        <circle cx="30" cy="30" r="1" fill="#fff" />
        <circle cx="40" cy="20" r="0.8" fill="#fff" />
        <circle cx="80" cy="56" r="0.8" fill="#fff" />
      </g>
      <text fontFamily="'Press Start 2P', monospace" fontSize="7" fill="#ff9cee" letterSpacing="1">
        <textPath href="#patch-arc-top" startOffset="50%" textAnchor="middle">
          EXOPLANET
        </textPath>
      </text>
      <text fontFamily="'Press Start 2P', monospace" fontSize="6" fill="#5ee7ff" letterSpacing="1">
        <textPath href="#patch-arc-bottom" startOffset="50%" textAnchor="middle">
          ROCKET BUILDER
        </textPath>
      </text>
    </svg>
  );
}
