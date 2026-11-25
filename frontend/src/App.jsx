import { useCallback, useEffect, useState } from "react";
import {
  fetchTickets,
  fetchTicketStats,
  updateTicket,
} from "./api/ticketsApi";
import StatsDashboard from "./components/StatsDashboard";
import TicketForm from "./components/TicketForm";
import TicketList from "./components/TicketList";

const INITIAL_FILTERS = {
  search: "",
  category: "",
  priority: "",
  status: "",
};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState("");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [updatingId, setUpdatingId] = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const data = await fetchTicketStats();
      setStats(data);
    } catch (err) {
      setStatsError(err.message || "Error loading stats.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async (activeFilters) => {
    setTicketsLoading(true);
    setTicketsError("");
    try {
      const data = await fetchTickets(activeFilters);
      setTickets(data);
    } catch (err) {
      setTicketsError(err.message || "Error loading tickets.");
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTickets(filters);
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, loadTickets]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleTicketCreated = () => {
    loadTickets(filters);
    loadStats();
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    setUpdatingId(ticketId);
    try {
      const updated = await updateTicket(ticketId, { status: newStatus });
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, status: updated.status }
            : ticket
        )
      );
      loadStats();
    } catch (err) {
      setTicketsError(err.message || "Failed to update ticket status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              InsightForge Support
            </h1>
            <p className="text-xs text-gray-500">
              AI-assisted ticket triage &amp; live operations dashboard
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <StatsDashboard
          stats={stats}
          isLoading={statsLoading}
          error={statsError}
        />

        <TicketForm onTicketCreated={handleTicketCreated} />

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
          <TicketList
            tickets={tickets}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onStatusChange={handleStatusChange}
            updatingId={updatingId}
            isLoading={ticketsLoading}
            error={ticketsError}
          />
        </div>
      </main>
    </div>
  );
}
