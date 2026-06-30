import { cn } from '@/lib/utils';

interface ArcadiaLogoProps {
  className?: string;
  size?: number;
  /** Show flat single-color (uses currentColor) instead of gradient */
  monochrome?: boolean;
}

/**
 * Arcadia mark — a stylized "A" formed by an ascending peak/path,
 * housed in a rounded-square emblem. Reads as a mountain summit
 * (progress, adventure) and as the letter A (Arcadia).
 */
export function ArcadiaLogo({ className, size = 40, monochrome = false }: ArcadiaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="Arcadia"
    >
      <defs>
        <linearGradient id="arcadia-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
        <linearGradient id="arcadia-mark" x1="12" y1="38" x2="36" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>

      {/* Emblem */}
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="11"
        fill={monochrome ? 'currentColor' : 'url(#arcadia-bg)'}
      />

      {/* Stylized A: ascending peak with crossbar = horizon/progress */}
      <path
        d="M14 36 L24 12 L34 36"
        stroke={monochrome ? 'hsl(var(--background))' : 'url(#arcadia-mark)'}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Crossbar — horizon / level-up line */}
      <path
        d="M18.5 27 L29.5 27"
        stroke={monochrome ? 'hsl(var(--background))' : 'url(#arcadia-mark)'}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Summit star — quest marker */}
      <circle
        cx="24"
        cy="12"
        r="2.2"
        fill={monochrome ? 'hsl(var(--background))' : '#FFD66B'}
      />
    </svg>
  );
}

/** Full wordmark: emblem + "Arcadia" type */
export function ArcadiaWordmark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ArcadiaLogo size={size} />
      <span
        className="font-display font-semibold tracking-tight text-foreground"
        style={{ fontSize: size * 0.7, letterSpacing: '-0.02em' }}
      >
        Arcadia
      </span>
    </div>
  );
}