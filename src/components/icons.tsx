import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props
  };
}

export function ArrowUpRight({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function ArrowRight({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function PlusIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export function MapPinIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

export function TrashIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
    </svg>
  );
}

export function UploadIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function MoveIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 3v18M3 12h18" />
      <path d="m8 7 4-4 4 4M8 17l4 4 4-4M7 8 3 12l4 4M17 8l4 4-4-4" />
    </svg>
  );
}

export function SearchIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function CheckIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m5 12.5 4.2 4L19 7" />
    </svg>
  );
}

export function SparkIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z" />
      <path d="m18.5 16 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </svg>
  );
}

export function HeartIcon({ size = 15, filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base({ size, ...props, fill: filled ? 'currentColor' : 'none' })}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function InfoIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function RestoreIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M3 4v6h6" />
      <path d="M3.5 13a8.5 8.5 0 1 0 2-6.4L3 10" />
    </svg>
  );
}
