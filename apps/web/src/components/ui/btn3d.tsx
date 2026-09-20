"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export type Btn3dVariant = "green" | "blue" | "purple" | "orange" | "gold" | "red" | "ghost" | "hue";

interface Common {
  variant?: Btn3dVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
  /** play the tap sound (default true) */
  sound?: boolean;
  /** width auto instead of 100% */
  auto?: boolean;
}

/** 3D hard-edge button (DESIGN.md). Renders a <button>, or a <Link> when `href` is given. */
export function Btn3d({ variant = "green", size = "md", className, children, sound = true, auto, href, onClick, ...rest }: Common & { href?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const sfx = useSfx();
  const cls = cn("btn3d", variant, size !== "md" && size, auto && "wauto", className);
  if (href) {
    return (
      <Link href={href} className={cls} onClick={() => sound && sfx.play("tap")} aria-disabled={rest.disabled || undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        if (sound) sfx.play("tap");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
