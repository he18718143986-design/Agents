interface SnailMarkProps {
  className?: string;
  /** Rounded tile background (nav / footer). */
  tile?: boolean;
}

function SnailGraphic() {
  return (
    <>
      <g className="snail-fill">
        <circle cx="29.5" cy="23.5" r="12.8" />
        <ellipse cx="14.5" cy="31.2" rx="11.2" ry="5.2" />
        <ellipse cx="10.2" cy="26.8" rx="4.8" ry="3.6" />
      </g>
      <g className="snail-spiral">
        <path d="M29.5 23.5m-9.2 0a9.2 9.2 0 1 1 6.5 6.5" />
        <path d="M29.5 23.5m-6 0a6 6 0 1 1 4.24 4.24" />
        <path d="M29.5 23.5m-3 0a3 3 0 1 1 2.12 2.12" />
        <circle cx="29.5" cy="23.5" r="1.8" className="snail-core" />
      </g>
      <g className="snail-face">
        <path d="M9.2 25.8 7 19.6" className="snail-stalk" />
        <path d="M12.8 25.2 13.8 18.8" className="snail-stalk" />
        <circle cx="7" cy="18.8" r="2.1" className="snail-eye" />
        <circle cx="13.8" cy="18.2" r="2.1" className="snail-eye" />
      </g>
    </>
  );
}

export function SnailMark({ className, tile = true }: SnailMarkProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      {tile ? <rect x="3" y="3" width="42" height="42" rx="9" /> : null}
      <SnailGraphic />
    </svg>
  );
}

export function SnailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <rect x="3" y="3" width="42" height="42" rx="9" />
      <SnailGraphic />
    </svg>
  );
}
