/**
 * API client layer for the Support Ticket System backend.
 * Isolates HTTP transport, query string building, and error parsing from UI components.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000/api"
).replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.detail) {
        message = errorBody.detail;
      } else if (typeof errorBody === "object" && errorBody !== null) {
        const fieldErrors = Object.entries(errorBody)
          .map(([field, msgs]) => `${field}: ${[].concat(msgs).join(", ")}`)
          .join("; ");
        if (fieldErrors) {
          message = fieldErrors;
        }
      }
    } catch {
      // Preserve generic HTTP status message when response body is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchTickets({
  category = "",
  priority = "",
  status = "",
  search = "",
} = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (priority) params.set("priority", priority);
  if (status) params.set("status", status);
  if (search.trim()) params.set("search", search.trim());

  const query = params.toString();
  return request(`/tickets/${query ? `?${query}` : ""}`);
}

export async function createTicket(payload) {
  return request("/tickets/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTicket(id, payload) {
  return request(`/tickets/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchTicketStats() {
  return request("/tickets/stats/");
}

export async function classifyTicket(description) {
  return request("/tickets/classify/", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}
