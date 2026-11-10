import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api-client";

// tailwind-merge resolves conflicts (e.g. base w-full vs a w-52 override); it must know the custom type scale.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["page", "section", "card", "body", "helper", "overline", "kpi"] }],
      rounded: [{ rounded: ["input", "menu", "card", "modal"] }],
    },
  },
});

export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes));

// Puts API validation errors (zod flattenError shape) onto form fields.
// Returns the message to show in a toast when nothing could be mapped to a field.
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): string | null {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";
  const fields = Object.entries(error.fieldErrors);
  for (const [name, message] of fields) setError(name as Path<T>, { type: "server", message });
  return fields.length ? null : error.message;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Try again.";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
const longDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Kolkata",
});

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "—");
export const formatDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : "—");
export const formatLongDate = (d = new Date()) => longDate.format(d);

export const initials = (first: string, last?: string) => `${first[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
