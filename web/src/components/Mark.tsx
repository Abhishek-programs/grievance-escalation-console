export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#181a1d" />
      <path
        d="M21.6 13.2a6.4 6.4 0 1 0 1.2 6.6"
        fill="none"
        stroke="#eeefed"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M16.2 16.2h6.4" fill="none" stroke="#b82340" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
