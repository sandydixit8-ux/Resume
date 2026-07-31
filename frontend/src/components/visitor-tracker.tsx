"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { trackVisitor } from "@/lib/api"

export default function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname && !pathname.startsWith("/admin")) {
      trackVisitor(pathname)
    }
  }, [pathname])

  return null
}
