"use client";

import { useState } from "react";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const json = await res.json();
      if (json.ok) {
        setSubject("");
        setBody("");
        setStatus("sent");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-navy-900">Need help?</h2>
        <p className="mt-0.5 text-xs text-navy-500">Submit a support ticket and the team will get back to you here.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          maxLength={200}
          className="input"
          aria-label="Subject"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you need help with?"
          rows={4}
          maxLength={4000}
          className="input resize-none"
          aria-label="Message"
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={status === "sending"} className="btn-primary !py-2 text-sm">
            {status === "sending" ? "Sending…" : "Submit ticket"}
          </button>
          {status === "sent" && <span className="text-xs font-medium text-emerald-600">Ticket submitted — we&apos;ll be in touch.</span>}
          {status === "error" && <span className="text-xs font-medium text-red-600">Could not submit. Please try again.</span>}
        </div>
      </form>
    </div>
  );
}