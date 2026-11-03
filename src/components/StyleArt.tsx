import { useId } from "react";
import type { EnsaioStyle } from "@/lib/styles";

/**
 * Ilustração vetorial de um cenário de ensaio (balões + número + silhueta),
 * usada quando não há foto de exemplo em /public/examples.
 */
export function StyleArt({ style, age = 30, className }: { style: EnsaioStyle; age?: number | string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const { bg, balloons, number, dark } = style.art;
  const digits = String(age).slice(0, 3);
  const cluster: [number, number, number, number][] = [
    [40, 70, 34, 0], [88, 46, 28, 1], [22, 128, 26, 2], [262, 60, 32, 1], [218, 38, 24, 0], [282, 124, 26, 2],
    [60, 300, 30, 1], [254, 310, 34, 0], [24, 252, 22, 2], [290, 260, 22, 1],
  ];

  return (
    <svg viewBox="0 0 320 420" className={className} role="img" aria-label={`Ilustração do estilo ${style.name}`}>
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <linearGradient id={`num${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={number[0]} />
          <stop offset="0.55" stopColor={number[1]} />
          <stop offset="1" stopColor={number[0]} />
        </linearGradient>
        <radialGradient id={`light${uid}`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.16 : 0.7} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`person${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark ? "#3a302a" : "#e9d3c7"} />
          <stop offset="1" stopColor={dark ? "#221c18" : "#d8b9a8"} />
        </linearGradient>
      </defs>

      <rect width="320" height="420" fill={`url(#bg${uid})`} />
      <rect width="320" height="420" fill={`url(#light${uid})`} />
      <ellipse cx="160" cy="400" rx="190" ry="46" fill={dark ? "#000" : "#fff"} opacity={dark ? 0.35 : 0.45} />

      {cluster.map(([x, y, r, c], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 1.12} fill={balloons[c % balloons.length]} />
          <ellipse cx={x - r * 0.35} cy={y - r * 0.4} rx={r * 0.2} ry={r * 0.3} fill="#fff" opacity="0.45" />
        </g>
      ))}

      {/* silhueta */}
      <g opacity="0.95">
        <path d="M110 420 C 112 330, 130 300, 160 296 C 190 300, 208 330, 210 420 Z" fill={`url(#person${uid})`} />
        <ellipse cx="160" cy="262" rx="28" ry="33" fill={`url(#person${uid})`} />
      </g>

      {/* número em balão metalizado */}
      <text
        x="160"
        y="200"
        textAnchor="middle"
        fontFamily="var(--font-playfair), Georgia, serif"
        fontWeight="800"
        fontSize={digits.length > 2 ? 110 : 140}
        fill={`url(#num${uid})`}
        stroke={number[1]}
        strokeWidth="2"
        style={{ paintOrder: "stroke" }}
      >
        {digits}
      </text>

      {[...Array(14)].map((_, i) => (
        <circle
          key={i}
          cx={(i * 53) % 320}
          cy={(i * 97) % 380}
          r={i % 3 === 0 ? 2.2 : 1.4}
          fill={dark ? "#e3c27a" : "#d4a64a"}
          opacity="0.7"
        />
      ))}
    </svg>
  );
}
