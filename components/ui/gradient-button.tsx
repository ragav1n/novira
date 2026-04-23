"use client"

import React from "react"
import Link from "next/link"

interface AdvancedButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  variant?: "primary" | "secondary" | "ghost" | "gradient"
  size?: "small" | "medium" | "large"
  disabled?: boolean
  gradientType?: "animated" | "static" | "radial" | "conic"
  className?: string
  href?: string
}

export const AdvancedButton = ({
  children,
  onClick,
  variant = "primary",
  size = "medium",
  disabled = false,
  gradientType = "static",
  className = "",
  href,
}: AdvancedButtonProps) => {
  const sizeStyles: Record<string, string> = {
    small:  "px-4 py-2 text-xs rounded-[10px]",
    medium: "px-5 py-2.5 text-sm rounded-xl",
    large:  "px-8 py-4 text-base rounded-xl",
  }

  const gradientBg: Record<string, string> = {
    static:   "bg-[linear-gradient(135deg,#4A0E8F_0%,#7B39FC_35%,#8A2BE2_65%,#6D28D9_100%)]",
    animated: "bg-[linear-gradient(135deg,#4A0E8F_0%,#7B39FC_35%,#8A2BE2_65%,#6D28D9_100%)] animate-gradient-shift",
    radial:   "bg-[radial-gradient(ellipse_at_center,#9333EA_0%,#6D28D9_50%,#4A0E8F_100%)]",
    conic:    "bg-[conic-gradient(from_135deg,#4A0E8F,#7B39FC,#8A2BE2,#9333EA,#4A0E8F)]",
  }

  const variantStyles: Record<string, string> = {
    primary:   `${gradientBg[gradientType]} text-white border border-purple-500/30`,
    secondary: `bg-[rgba(85,80,110,0.35)] text-white border border-[rgba(164,132,215,0.4)] backdrop-blur-xl`,
    ghost:     `bg-transparent text-white/80 border border-[rgba(164,132,215,0.3)] hover:bg-[rgba(85,80,110,0.3)]`,
    gradient:  `${gradientBg[gradientType]} text-white border border-purple-500/30`,
  }

  const combined = [
    "relative inline-flex items-center justify-center gap-2 font-semibold",
    "transition-all duration-300 ease-out select-none whitespace-nowrap overflow-hidden",
    "shadow-[0_0_20px_rgba(138,43,226,0.4)]",
    "hover:shadow-[0_0_36px_rgba(138,43,226,0.7)] hover:scale-[1.03] hover:brightness-110",
    "active:scale-[0.97]",
    disabled ? "opacity-50 pointer-events-none" : "cursor-pointer",
    sizeStyles[size],
    variantStyles[variant],
    // shimmer pseudo-element via group
    "group",
    className,
  ].join(" ")

  const inner = (
    <>
      {/* shimmer sweep on hover */}
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.18)_50%,transparent_60%)]"
        aria-hidden
      />
      {children}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={combined}>
        {inner}
      </Link>
    )
  }

  return (
    <button className={combined} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {inner}
    </button>
  )
}
