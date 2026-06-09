import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, deduplicating conflicting utilities.
 *
 * Combines `clsx` (truthy filtering, arrays, nested conditions) with
 * `tailwind-merge` (last-write-wins resolution of conflicting utilities).
 *
 * @example
 *   cn("p-2", "p-4")                            // → "p-4"
 *   cn("flex", { hidden: false })               // → "flex"
 *   cn(["text-sm", { "font-bold": isActive }])  // → "text-sm font-bold"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
