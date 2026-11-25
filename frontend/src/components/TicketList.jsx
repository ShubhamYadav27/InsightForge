import { useState } from "react";
import {
  CATEGORIES,
  CATEGORY_BADGE_CLASSES,
  PRIORITIES,
  PRIORITY_BADGE_CLASSES,
  STATUSES,
  STATUS_SELECT_CLASSES,
} from "../constants/ticketOptions";

const DESCRIPTION_PREVIEW_LIMIT = 140;

function formatTimestamp(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TicketRow({ ticket, onStatusChange, isUpdating }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const description = ticket.description || "";
  const isLongDescription = description.length > DESCRIPTION_PREVIEW_LIMIT;
  const displayedDescription =
    isExpanded || !isLongDescription
      ? description
      : `${description.slice(0, DESCRIPTION_PREVIEW_LIMIT).trimEnd()}...`;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">
              {ticket.title}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                CATEGORY_BADGE_CLASSES[ticket.category] ||
                "bg-gray-100 text-gray-700 ring-gray-600/20"
              }`}
            >
              {ticket.category}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                PRIORITY_BADGE_CLASSES[ticket.priority] ||
                "bg-gray-100 text-gray-700 ring-gray-600/20"
              }`}
            >
              {ticket.priority}
            </span>
          </div>

          <p
            onClick={() => isLongDescription && setIsExpanded((prev) => !prev)}
            title={isLongDescription ? "Click to toggle full description" : undefined}
            className={`mt-2 whitespace-pre-line text-sm text-gray-600 ${
              isLongDescription ? "cursor-pointer hover:text-gray-800" : ""
            }`}
          >
            {displayedDescription}
            {isLongDescription && (
              <span className="ml-1.5 text-xs font-medium text-indigo-600">
                {isExpanded ? "Show less" : "Read more"}
              </span>
            )}
          </p>

          <p className="mt-2.5 text-xs text-gray-400">
            #{ticket.id} &middot; Created {formatTimestamp(ticket.created_at)}
          </p>
        </div>

        <div className="shrink-0 sm:pl-4">
          <label htmlFor={`status-${ticket.id}`} className="sr-only">
            Ticket Status
          </label>
          <select
            id={`status-${ticket.id}`}
            disabled={isUpdating}
            value={ticket.status}
            onChange={(e) => onStatusChange(ticket.id, e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 ${
              STATUS_SELECT_CLASSES[ticket.status] ||
              "border-gray-200 bg-gray-50 text-gray-700"
            }`}
          >
            {STATUSES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}

export default function TicketList({
  tickets,
  filters,
  onFilterChange,
  onClearFilters,
  onStatusChange,
  updatingId,
  isLoading,
  error,
}) {
  const hasActiveFilters = Boolean(
    filters.search || filters.category || filters.priority || filters.status
  );

  return (
    <section aria-label="Support Tickets" className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="filter-search" className="sr-only">
              Search tickets
            </label>
            <input
              id="filter-search"
              type="search"
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              placeholder="Search title or description..."
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) => onFilterChange("category", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by priority"
            value={filters.priority}
            onChange={(e) => onFilterChange("priority", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="shrink-0 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load tickets: {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {hasActiveFilters
            ? "No tickets match the current filters."
            : "No support tickets yet. Submit one above to get started."}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onStatusChange={onStatusChange}
              isUpdating={updatingId === ticket.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
