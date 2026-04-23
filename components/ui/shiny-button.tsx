"use client"

import type React from "react"
import Link from "next/link"

interface ShinyButtonProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  href?: string
  size?: "default" | "sm"
}

export function ShinyButton({ children, onClick, className = "", href, size = "default" }: ShinyButtonProps) {
  const combinedClass = `shiny-cta ${size === "sm" ? "shiny-cta-sm" : ""} ${className}`.trim()

  if (href) {
    return (
      <Link href={href} className={combinedClass}>
        <span>{children}</span>
      </Link>
    )
  }

  return (
    <button className={combinedClass} onClick={onClick}>
      <span>{children}</span>
    </button>
  )
}
