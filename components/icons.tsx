import type { SVGProps } from "react";

export function Arrow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 17 12" fill="none" aria-hidden width="17" height="12" {...props}>
      <path
        d="M1 6h14M11 1.5L15.5 6 11 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Chevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 9 14" fill="none" aria-hidden width="9" height="14" {...props}>
      <path
        d="M1.5 1l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 14 12" fill="none" aria-hidden width="14" height="12" {...props}>
      <path
        d="M1 6.5L5 10.5 13 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Back(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 15 11" fill="none" aria-hidden width="15" height="11" {...props}>
      <path
        d="M14 5.5H2M5.5 1.5L1 5.5 5.5 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
