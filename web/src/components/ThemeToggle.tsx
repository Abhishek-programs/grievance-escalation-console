export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className="theme-toggle" aria-label={label} onClick={onToggle}>
      <span className="landscape" aria-hidden="true">
        <svg viewBox="0 0 60 28" fill="none" focusable="false">
          <path className="sky" d="M0 0h60v28H0z" />
          <g className="stars" fill="currentColor">
            <path className="star" d="m13 5 .65 1.85L15.5 7.5l-1.85.65L13 10l-.65-1.85-1.85-.65 1.85-.65Z" />
            <circle className="star" cx="27" cy="5.5" r=".8" />
            <circle className="star" cx="32" cy="12" r=".65" />
          </g>
          <g className="sun-orbit">
            <circle className="sun-halo" cx="18" cy="10" r="9" />
            <g className="sun-rays" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M18 2v1.5m0 13V18M10 10h1.5m13 0H26M12.35 4.35l1.06 1.06m9.18 9.18 1.06 1.06m-11.3 0 1.06-1.06m9.18-9.18 1.06-1.06" />
            </g>
            <circle className="sun" cx="18" cy="10" r="4.3" />
          </g>
          <g className="moon-orbit">
            <path className="moon" d="M45.9 4.2a5.6 5.6 0 1 0 3.7 8.6 5.9 5.9 0 0 1-3.7-8.6Z" />
          </g>
          <path className="ridge-back" d="m0 25 10-10 5 5L29 6l14 16 7-7 10 10v3H0Z" />
          <path className="snow" d="m22.6 12.4 6.4-6.4 6.5 7.4-5-2.3-2.1 1.4-1.9-1.3Z" />
          <path className="ridge-front" d="m0 23 8-3 10 5 12-9 12 8 9-4 9 4v4H0Z" />
          <path className="ridge-edge" d="m18 25 12-9 12 8" strokeWidth=".6" />
        </svg>
      </span>
    </button>
  );
}
