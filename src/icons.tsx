type IconProps = { className?: string };

export function LeafMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 27V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 18.2c-5.4-.7-8.2-4.8-7.3-8.8 4.4.7 7 3.8 7.3 8.8z" fill="currentColor" />
      <path d="M16 15.6c5.4-.8 8.4-4.4 7.5-8.2-4.6.8-7.2 3.6-7.5 8.2z" fill="currentColor" opacity="0.72" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 8.3 6.4 11.4 12.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12.2 10.4 14.5 16 9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HabitsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8a5 5 0 0 1 8.2-1.5L17 8.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 16a5 5 0 0 1-8.2 1.5L7 15.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 5.5V8h2.5M8 18.5V16H5.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function JournalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h9.2A2.3 2.3 0 0 1 18.5 6.8v12.7H8.2A2.2 2.2 0 0 0 6 21.7V6.7A2.2 2.2 0 0 1 8.2 4.5H7z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 18.2h12.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function WeekIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 13.4 8l4.6.2-3.6 2.9 1.3 4.4L12 13.2 8.3 15.5 9.6 11 6 8.2 10.6 8 12 3.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function FlameIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.6s2.4 2.2 2.4 4.2c0 1-.6 1.6-1.2 1.6.8-.8.6-2 .6-2S8.2 7 8.2 9.2c0 2.6 1.6 4.2 3.4 4.6-4.8 1.2-7.6-1.4-7.6-4.8 0-2.4 1.6-3.8 2.4-5.2.2.8.8 1.4 1.6 1.6C8 4.4 8 1.6 8 1.6z" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="7.2" cy="8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 9.4 16.2 9.4M14.2 9.4v2.2M12.2 9.4v1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
      <path d="M8 4.2v4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="11.3" r="0.8" fill="currentColor" />
    </svg>
  );
}
