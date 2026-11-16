export function SecHubLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Security Center"
      className={className}
    >
      <defs>
        <linearGradient id="sechub-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path
        d="M32 3 7 12v18c0 14.6 10.4 25.8 25 31 14.6-5.2 25-16.4 25-31V12L32 3Z"
        fill="url(#sechub-gradient)"
        stroke="#dbeafe"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M32 9.5 12.5 17v13c0 11.8 8.2 21.2 19.5 25.6C43.3 51.2 51.5 41.8 51.5 30V17L32 9.5Z"
        fill="#0b1220"
        fillOpacity="0.35"
      />
      <path
        d="m22 32 7 7 13-14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
