import {
  CATEGORIES,
  CATEGORY_BAR_CLASSES,
  PRIORITIES,
  PRIORITY_BAR_CLASSES,
} from "../constants/ticketOptions";

function BreakdownCard({ title, items, counts, total, barClasses }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map(({ value, label }) => {
          const count = counts?.[value] ?? 0;
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={value}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="tabular-nums text-gray-500">
                  {count} ({percentage}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barClasses[value]}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StatsDashboard({ stats, isLoading, error }) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Unable to load ticket metrics: {error}
      </div>
    );
  }

  const totalTickets = stats?.total_tickets ?? 0;
  const openTickets = stats?.open_tickets ?? 0;
  const avgPerDay = stats?.avg_tickets_per_day ?? 0;

  const summaryCards = [
    {
      label: "Total Tickets",
      value: isLoading && !stats ? "—" : totalTickets,
      accent: "text-gray-900",
    },
    {
      label: "Open Tickets",
      value: isLoading && !stats ? "—" : openTickets,
      accent: "text-blue-600",
    },
    {
      label: "Avg Tickets / Day",
      value: isLoading && !stats ? "—" : avgPerDay.toFixed(1),
      accent: "text-indigo-600",
    },
  ];

  return (
    <section aria-label="Ticket Statistics" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {card.label}
            </p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${card.accent}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title="Priority Breakdown"
          items={PRIORITIES}
          counts={stats?.priority_breakdown}
          total={totalTickets}
          barClasses={PRIORITY_BAR_CLASSES}
        />
        <BreakdownCard
          title="Category Breakdown"
          items={CATEGORIES}
          counts={stats?.category_breakdown}
          total={totalTickets}
          barClasses={CATEGORY_BAR_CLASSES}
        />
      </div>
    </section>
  );
}
