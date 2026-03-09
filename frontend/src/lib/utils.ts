import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalises any stored DOB string to DD-MM-YYYY.
 * Handles:
 *   "YYYY-MM-DD"  → "DD-MM-YYYY"
 *   "DD-MM-YYYY"  → preserved as-is
 *   ISO / JS Date → "DD-MM-YYYY"  (via Date parsing)
 */
export function formatDOB(dob: string | null | undefined): string {
  if (!dob) return "—";

  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) return dob;

  // YYYY-MM-DD (ISO date, no time)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const [y, m, d] = dob.split("-");
    return `${d}-${m}-${y}`;
  }

  // Try generic Date parsing (handles ISO timestamps etc.)
  const date = new Date(dob);
  if (!isNaN(date.getTime())) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return dob; // fallback: return raw
}
