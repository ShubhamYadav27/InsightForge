import { useCallback, useEffect, useRef, useState } from "react";
import { classifyTicket, createTicket } from "../api/ticketsApi";
import { CATEGORIES, PRIORITIES } from "../constants/ticketOptions";

const MIN_CLASSIFY_LENGTH = 10;
const CLASSIFY_DEBOUNCE_MS = 700;

export default function TicketForm({ onTicketCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");

  const [isClassifying, setIsClassifying] = useState(false);
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState(false);
  const [aiSuggestedPriority, setAiSuggestedPriority] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Track manual overrides so delayed AI responses never clobber user choices.
  const manualCategoryRef = useRef(false);
  const manualPriorityRef = useRef(false);
  const lastClassifiedDescRef = useRef("");
  const classifySeqRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const runClassification = useCallback(async (rawText) => {
    const trimmed = rawText.trim();
    if (trimmed.length < MIN_CLASSIFY_LENGTH) {
      return;
    }
    if (lastClassifiedDescRef.current === trimmed) {
      return;
    }

    lastClassifiedDescRef.current = trimmed;
    const seq = ++classifySeqRef.current;
    setIsClassifying(true);

    try {
      const suggestion = await classifyTicket(trimmed);
      if (seq !== classifySeqRef.current) {
        return;
      }

      if (suggestion?.suggested_category && !manualCategoryRef.current) {
        setCategory(suggestion.suggested_category);
        setAiSuggestedCategory(true);
      }
      if (suggestion?.suggested_priority && !manualPriorityRef.current) {
        setPriority(suggestion.suggested_priority);
        setAiSuggestedPriority(true);
      }
    } catch {
      // Graceful degradation: classification failure must never block submission.
    } finally {
      if (seq === classifySeqRef.current) {
        setIsClassifying(false);
      }
    }
  }, []);

  useEffect(() => {
    const trimmed = description.trim();
    if (trimmed.length < MIN_CLASSIFY_LENGTH) {
      return undefined;
    }

    debounceTimerRef.current = setTimeout(() => {
      runClassification(description);
    }, CLASSIFY_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [description, runClassification]);

  const handleDescriptionBlur = () => {
    const trimmed = description.trim();
    if (
      trimmed.length >= MIN_CLASSIFY_LENGTH &&
      lastClassifiedDescRef.current !== trimmed
    ) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      runClassification(description);
    }
  };

  const handleCategoryChange = (e) => {
    manualCategoryRef.current = true;
    setAiSuggestedCategory(false);
    setCategory(e.target.value);
  };

  const handlePriorityChange = (e) => {
    manualPriorityRef.current = true;
    setAiSuggestedPriority(false);
    setPriority(e.target.value);
  };

  const resetForm = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    classifySeqRef.current += 1;
    manualCategoryRef.current = false;
    manualPriorityRef.current = false;
    lastClassifiedDescRef.current = "";

    setTitle("");
    setDescription("");
    setCategory("");
    setPriority("");
    setIsClassifying(false);
    setAiSuggestedCategory(false);
    setAiSuggestedPriority(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!title.trim() || !description.trim() || !category || !priority) {
      setError("Please fill in title, description, category, and priority.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      });
      resetForm();
      setSuccessMessage("Ticket submitted successfully.");
      if (onTicketCreated) {
        onTicketCreated(created);
      }
    } catch (err) {
      setError(err.message || "Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Submit a Support Ticket
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Describe your issue and AI will suggest a category and priority.
          </p>
        </div>

        {isClassifying && (
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
            AI analyzing description...
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="ticket-title"
              className="block text-sm font-medium text-gray-700"
            >
              Title <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-gray-400">{title.length}/200</span>
          </div>
          <input
            id="ticket-title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => {
              setSuccessMessage("");
              setTitle(e.target.value);
            }}
            placeholder="Brief summary of the issue"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="ticket-description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="ticket-description"
            required
            rows={4}
            value={description}
            onChange={(e) => {
              setSuccessMessage("");
              setDescription(e.target.value);
            }}
            onBlur={handleDescriptionBlur}
            placeholder="Provide full details (steps to reproduce, impact, error messages)..."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="ticket-category"
                className="block text-sm font-medium text-gray-700"
              >
                Category <span className="text-rose-500">*</span>
              </label>
              {aiSuggestedCategory && (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                  ✨ AI Suggested
                </span>
              )}
            </div>
            <select
              id="ticket-category"
              required
              value={category}
              onChange={handleCategoryChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="" disabled>
                Select category...
              </option>
              {CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="ticket-priority"
                className="block text-sm font-medium text-gray-700"
              >
                Priority <span className="text-rose-500">*</span>
              </label>
              {aiSuggestedPriority && (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                  ✨ AI Suggested
                </span>
              )}
            </div>
            <select
              id="ticket-priority"
              required
              value={priority}
              onChange={handlePriorityChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="" disabled>
                Select priority...
              </option>
              {PRIORITIES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </div>
      </form>
    </section>
  );
}
