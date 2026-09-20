import type { SVGProps } from "react";

export type IconName =
  | "home" | "bolt" | "trophy" | "user" | "flame" | "gem" | "heart" | "heart-off" | "infinity" | "lock" | "check" | "star" | "chest" | "play" | "close"
  | "volume" | "volume-off" | "back" | "chevron" | "plus" | "camera" | "pen" | "calendar" | "target" | "layers" | "sparkles" | "flag" | "zap" | "gift" | "moon" | "sun"
  | "clock" | "book" | "cards" | "quiz" | "exam" | "info" | "swap" | "snow" | "medal" | "crown" | "arrow-up" | "arrow-down" | "shield";

const P: Record<IconName, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6z" />,
  trophy: <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zm-1 4v1a2 2 0 0 0 2 2V7zm12 0h-2v3a2 2 0 0 0 2-2z" />,
  user: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9a8 8 0 0 1 16 0z" />,
  flame: <path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-1.5.5-2.8 1.3-3.8.3 1.1 1 2 1.9 2.4C10 8.5 10.8 4.6 12 2z" />,
  gem: <path d="M6 3h12l4 6-10 12L2 9zm1.3 6L12 17.6 16.7 9z" />,
  heart: <path d="M12 21s-8-5.3-8-11.2A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.8C20 15.7 12 21 12 21z" />,
  "heart-off": <path d="M12 21s-8-5.3-8-11.2A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.8C20 15.7 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="2" />,
  infinity: <path d="M7 8a4 4 0 0 0 0 8c2.5 0 3.7-2 5-4s2.5-4 5-4a4 4 0 0 1 0 8c-2.5 0-3.7-2-5-4s-2.5-4-5-4z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
  lock: <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z" />,
  check: <path d="M9.2 16.6 4.8 12.2l-1.6 1.6 6 6 12-12-1.6-1.6z" />,
  star: <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />,
  chest: <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3H4zm0 5h6v2h4v-2h6v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />,
  play: <path d="M8 5v14l11-7z" />,
  close: <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7l1.4-1.4L12 10.6l6.3-6.3z" />,
  volume: <path d="M4 9v6h4l5 4V5L8 9zm11.5 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2zM13.5 4.5v2.1a6 6 0 0 1 0 10.8v2.1a8 8 0 0 0 0-15z" />,
  "volume-off": <path d="M4 9v6h4l5 4V5L8 9zm14.4 3 2.3-2.3-1.4-1.4L17 10.6l-2.3-2.3-1.4 1.4L15.6 12l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4z" />,
  back: <path d="m15 4-8 8 8 8 1.8-1.8L10.6 12l6.2-6.2z" />,
  chevron: <path d="m9 4 8 8-8 8-1.8-1.8L13.4 12 7.2 5.8z" />,
  plus: <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />,
  camera: <path d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />,
  pen: <path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zm17.7-10.1a1 1 0 0 0 0-1.4l-2.5-2.5a1 1 0 0 0-1.4 0l-1.9 1.9 3.7 3.7z" />,
  calendar: <path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h3zm-2 8v9h14v-9z" />,
  target: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />,
  layers: <path d="m12 3 10 5-10 5L2 8zm-7.5 8.6L12 16l7.5-4.4 2.5 1.4-10 5-10-5z" />,
  sparkles: <path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8zm8 10 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />,
  flag: <path d="M5 3h2v18H5zm3 1h11l-3 4 3 4H8z" />,
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6z" />,
  gift: <path d="M12 6a3 3 0 1 0-3-3c0 .4.1.7.2 1H4v5h1v11h14V9h1V4h-5.2c.1-.3.2-.6.2-1a3 3 0 0 0-3 3zm-1 3v11H7V9zm6 0v11h-4V9z" />,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  sun: <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5h0v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  clock: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h2v5.4l3.6 2.1-1 1.7L11 13z" />,
  book: <path d="M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3zm2 2v11.2A3 3 0 0 1 7 16h11V6a1 1 0 0 0-1-1z" />,
  cards: <path d="M3 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm5-4h12a2 2 0 0 1 2 2v12h-2V4H8z" />,
  quiz: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 15.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM13 13h-2v-.6c0-1.3.7-1.9 1.6-2.5.7-.5 1.2-.9 1.2-1.6 0-.9-.8-1.5-1.8-1.5-1.1 0-1.9.7-2 1.7l-2-.4C8.3 6.2 9.9 4.8 12 4.8c2.2 0 3.8 1.4 3.8 3.4 0 1.5-.9 2.3-1.8 2.9-.7.5-1 .8-1 1.4z" />,
  exam: <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5zM8 12h8v2H8zm0 4h8v2H8z" />,
  info: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm-1-8.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" />,
  swap: <path d="M7 3 3 7l4 4V8h10V6H7zm10 18 4-4-4-4v3H7v2h10z" />,
  snow: <path d="M11 2h2v4.6l2.5-1.5 1 1.7L13 8.9v2.4l2-1.2 4-2.3-.9-2.7 1.9-.6 1.3 4.1-4.1 1.3-.6-1.9-4 2.3 4 2.3.6-1.9 4.1 1.3-1.3 4.1-1.9-.6.9-2.7-4-2.3-2 1.2v2.4l3.5 2.1-1 1.7L13 17.4V22h-2v-4.6l-2.5 1.5-1-1.7 3.5-2.1v-2.4l-2 1.2-4 2.3.9 2.7-1.9.6L2.7 15.4l4.1-1.3.6 1.9 4-2.3-4-2.3-.6 1.9-4.1-1.3L4 7.9l1.9.6L5 11.2l4 2.3 2-1.2V9.9L7.5 7.8l1-1.7L11 7.6z" />,
  medal: <path d="M7 2h10l-3 7h-4zm5 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2.5-1 2.2-2.4.3 1.8 1.6-.5 2.4 2.1-1.2 2.1 1.2-.5-2.4 1.8-1.6-2.4-.3z" />,
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5zm2 14h14v2H5z" />,
  "arrow-up": <path d="M12 4 5 11l1.4 1.4L11 7.8V20h2V7.8l4.6 4.6L19 11z" />,
  "arrow-down": <path d="m12 20 7-7-1.4-1.4-4.6 4.6V4h-2v12.2L6.4 11.6 5 13z" />,
  shield: <path d="M12 2 4 5v6c0 5.3 3.4 9.7 8 11 4.6-1.3 8-5.7 8-11V5zm-1.5 14-3.5-3.5 1.4-1.4 2.1 2.1 5.1-5.1 1.4 1.4z" />,
};

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {P[name]}
    </svg>
  );
}
