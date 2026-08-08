import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  placeholder?: string
  loading?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, loading, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]",
            className
          )}
          ref={ref}
          style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
          {...props}
        >
          {loading && <option value="" style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>{placeholder || "Loading..."}</option>}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
