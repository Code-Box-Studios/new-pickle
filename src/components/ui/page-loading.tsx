import styles from "./page-loading.module.css";

function LoadingPaddle({ light = false }: { light?: boolean }) {
  const face = light ? "var(--color-brand-200)" : "var(--color-brand-950)";
  const detail = light ? "var(--color-brand-700)" : "var(--color-brand-200)";

  return (
    <>
      <rect
        x="-5"
        y="20"
        width="10"
        height="29"
        rx="4"
        fill="var(--color-brand-950)"
      />
      <path
        d="M-4 32h8M-4 37h8M-4 42h8"
        stroke="var(--color-brand-300)"
        strokeWidth="1.5"
      />
      <rect
        x="-18"
        y="-31"
        width="36"
        height="55"
        rx="15"
        fill={face}
        stroke="var(--color-brand-700)"
        strokeWidth="1.5"
      />
      <rect
        x="-13"
        y="-26"
        width="26"
        height="45"
        rx="11"
        fill="none"
        stroke={detail}
        strokeOpacity=".3"
      />
      <path
        d="M-5 6v-18h7a6 6 0 0 1 0 12h-7"
        fill="none"
        stroke={detail}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Route loading feedback that fits both the marketplace and venue workspace. */
export function PageLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={styles.root}
    >
      <svg
        viewBox="0 0 280 160"
        className={styles.scene}
        aria-hidden="true"
        focusable="false"
      >
        <ellipse
          cx="140"
          cy="88"
          rx="112"
          ry="49"
          fill="var(--color-brand-100)"
          opacity=".6"
        />
        <path
          d="M70 76Q140 43 210 76Q140 109 70 76"
          fill="none"
          stroke="var(--color-brand-700)"
          strokeOpacity=".12"
          strokeWidth="1.5"
          strokeDasharray="2 6"
        />

        <g transform="translate(42 76)">
          <g className={styles.paddleLeft}>
            <LoadingPaddle />
          </g>
        </g>
        <g transform="translate(238 76)">
          <g className={styles.paddleRight}>
            <LoadingPaddle light />
          </g>
        </g>

        <g transform="translate(70 76)">
          <circle
            className={styles.hitLeft}
            r="15"
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth="1.5"
          />
        </g>
        <g transform="translate(210 76)">
          <circle
            className={styles.hitRight}
            r="15"
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth="1.5"
          />
        </g>

        <g className={styles.flight}>
          <circle r="14" fill="var(--color-brand-green)" opacity=".12" />
          <g className={styles.ball}>
            <circle
              r="9"
              fill="var(--color-brand-green)"
              stroke="var(--color-brand-700)"
              strokeWidth="1"
            />
            <g fill="var(--color-brand-950)">
              <circle cx="-3" cy="-3" r="1.5" />
              <circle cx="3.5" cy="-2.5" r="1.5" />
              <circle cx="0" cy="3.5" r="1.5" />
            </g>
          </g>
        </g>
      </svg>
      <p className={styles.label}>
        Loading Pikol<span aria-hidden="true">…</span>
      </p>
      <span className="sr-only">Please wait while the page loads.</span>
    </div>
  );
}
