"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

export function CreateCommunity() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Could not create community");
        setLoading(false);
        return;
      }
      router.push(`/app/community/${json.data.id}`);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
      <h2 className="font-semibold text-navy-900">Create a community</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" maxLength={80} className="input" />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this space about?"
        maxLength={500}
        rows={2}
        className="input resize-none"
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button type="submit" disabled={loading || !name.trim()} className="btn-primary self-start">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create community
      </button>
    </form>
  );
}