"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

type RevealProps = {
  children: ReactNode
  className?: string
  variant?: "up" | "left" | "right" | "zoom"
  delay?: 0 | 1 | 2 | 3 | 4 | 5
  as?: "div" | "section" | "li" | "span"
}

export default function Reveal({ children, className = "", variant = "up", delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const variantClass = variant === "left" ? "reveal-left" : variant === "right" ? "reveal-right" : variant === "zoom" ? "reveal-zoom" : ""
  const delayClass = delay > 0 ? `reveal-delay-${delay}` : ""
  const Tag = as

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${variantClass} ${delayClass} ${visible ? "reveal-visible" : ""} ${className}`}
    >
      {children}
    </Tag>
  )
}
