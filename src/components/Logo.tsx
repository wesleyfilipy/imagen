export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef8fab" />
          <stop offset="1" stopColor="#d4a64a" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="16" rx="11" ry="13" fill="url(#logo-g)" />
      <ellipse cx="16" cy="11" rx="3" ry="4.5" fill="#fff" opacity=".5" />
      <path d="M18.5 29 h3 l-1.5 2.5z" fill="#d4a64a" />
      <path d="M20 31.5 C 17 34, 23 35.5, 20 39" stroke="#d4a64a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
