"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, ThumbsUp, Trash2 } from "lucide-react";

interface FeedPost {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  reactions: number;
  comments: number;
  my_reaction: number;
  created_at: string;
}

export function CommunityFeed({
  communityId,
  initialPosts,
  currentUserId,
  manager,
}: {
  communityId: string;
  initialPosts: FeedPost[];
  currentUserId: string;
  manager: boolean;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/community/${communityId}`);
    const json = await res.json();
    if (json.ok) setPosts(json.data.posts);
  }, [communityId]);

  async function post() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/community/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const json = await res.json();
      if (json.ok) setDraft("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function react(postId: string) {
    await fetch(`/api/community/${communityId}/posts/${postId}/react`, { method: "POST" });
    await reload();
  }

  async function comment(postId: string) {
    const body = commentDrafts[postId] ?? "";
    if (!body.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/community/${communityId}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setCommentDrafts((d) => ({ ...d, [postId]: "" }));
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function removePost(postId: string) {
    await fetch(`/api/community/${communityId}/posts/${postId}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share an update with your community…"
          maxLength={2000}
          rows={2}
          className="input resize-none"
        />
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={post} disabled={busy || !draft.trim()} className="btn-primary">
            <Send className="h-4 w-4" /> Post
          </button>
        </div>
      </div>

      {posts.length === 0 && (
        <div className="card p-10 text-center text-sm text-navy-500">No posts yet. Be the first to start the conversation.</div>
      )}

      {posts.map((p) => (
        <div key={p.id} className="card p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {p.author_name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="text-sm font-semibold text-navy-900">{p.author_name}</div>
                <div className="text-xs text-navy-400">{formatWhen(p.created_at)}</div>
              </div>
            </div>
            {(manager || p.author_id === currentUserId) && (
              <button type="button" onClick={() => removePost(p.id)} className="text-navy-300 hover:text-red-600" aria-label={`Delete post by ${p.author_name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-navy-800">{p.body}</p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => react(p.id)}
              aria-label="React to this post"
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                p.my_reaction ? "bg-brand-50 text-brand-700 ring-brand-200" : "text-navy-600 ring-navy-200 hover:bg-navy-50"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> {p.reactions}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
              aria-label={`Show comments for this post`}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-navy-600 ring-1 ring-navy-200 hover:bg-navy-50"
            >
              <MessageCircle className="h-3.5 w-3.5" /> {p.comments}
            </button>
          </div>

          {expanded[p.id] && (
            <div className="mt-4 space-y-3 border-t border-navy-100 pt-4">
              <CommentsFor communityId={communityId} postId={p.id} />
              <div className="flex gap-2">
                <input
                  value={commentDrafts[p.id] ?? ""}
                  onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  placeholder="Write a comment…"
                  maxLength={1000}
                  className="input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void comment(p.id);
                  }}
                />
                <button type="button" onClick={() => comment(p.id)} disabled={busy} className="btn-secondary">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function CommentsFor({ communityId, postId }: { communityId: string; postId: string }) {
  const [comments, setComments] = useState<{ id: string; body: string; author_name: string; created_at: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/community/${communityId}/posts/${postId}/comments`);
      const json = await res.json();
      if (json.ok) setComments(json.data.comments);
    })();
  }, [communityId, postId]);

  return (
    <div className="space-y-2">
      {comments.length === 0 && <p className="text-xs text-navy-400">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="rounded-lg bg-navy-50 px-3 py-2">
          <span className="text-xs font-semibold text-navy-900">{c.author_name}</span>
          <p className="mt-0.5 text-sm text-navy-700">{c.body}</p>
        </div>
      ))}
    </div>
  );
}