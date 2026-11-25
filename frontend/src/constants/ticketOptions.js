/**
 * Shared domain constants and display mappings for ticket fields.
 * Centralizing enum values and Tailwind badge styles avoids duplication across components.
 */

export const CATEGORIES = [
  { value: "billing", label: "Billing" },
  { value: "technical", label: "Technical" },
  { value: "account", label: "Account" },
  { value: "general", label: "General" },
];

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const CATEGORY_BADGE_CLASSES = {
  billing: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  technical: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  account: "bg-amber-50 text-amber-700 ring-amber-600/20",
  general: "bg-slate-100 text-slate-700 ring-slate-600/20",
};

export const PRIORITY_BADGE_CLASSES = {
  low: "bg-sky-50 text-sky-700 ring-sky-600/20",
  medium: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  high: "bg-orange-50 text-orange-700 ring-orange-600/20",
  critical: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export const PRIORITY_BAR_CLASSES = {
  low: "bg-sky-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-rose-600",
};

export const CATEGORY_BAR_CLASSES = {
  billing: "bg-emerald-500",
  technical: "bg-indigo-500",
  account: "bg-amber-500",
  general: "bg-slate-500",
};

export const STATUS_SELECT_CLASSES = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};
