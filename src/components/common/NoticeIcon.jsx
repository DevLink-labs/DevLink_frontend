export default function NoticeIcon({ kind }) {
  return (
    <svg
      className="toast-symbol"
      width="44"
      height="44"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "info" ? (
        <>
          <path
            className="toast-symbol-outline"
            d="M9 6h14a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H13l-8 4V10a4 4 0 0 1 4-4Z"
          />
          <path
            className="toast-response-line toast-response-line-first"
            pathLength="1"
            d="M11 13h10"
          />
          <path
            className="toast-response-line toast-response-line-second"
            pathLength="1"
            d="M11 18h6"
          />
        </>
      ) : kind === "success" ? (
        <>
          <circle
            className="toast-symbol-outline"
            cx="16"
            cy="16"
            r="11"
          />
          <path
            className="toast-check-mark"
            pathLength="1"
            strokeWidth="2.2"
            d="m10.5 16 3.7 3.7 7.3-7.4"
          />
        </>
      ) : (
        <>
          <circle
            className="toast-symbol-outline toast-warning-ring"
            pathLength="1"
            cx="16"
            cy="16"
            r="11"
          />
          <g className="toast-warning-mark">
            <path strokeWidth="2.2" d="M16 10.5v7" />
            <circle cx="16" cy="22" r="1.2" fill="currentColor" stroke="none" />
          </g>
        </>
      )}
    </svg>
  );
}
