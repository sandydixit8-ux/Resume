import { cn, initials } from "@/lib/utils";

const palettes = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
];

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };
  const palette = palettes[(name?.length ?? 0) % palettes.length];
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "avatar"}
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        palette,
        className
      )}
    >
      {initials(name)}
    </span>
  );
}