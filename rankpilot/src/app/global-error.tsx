"use client";

import { useEffect } from "react";

/**
 * Root error boundary.
 *
 * Without this, an unhandled render error in any segment takes down the whole
 * app and Next.js shows its built-in page, which leaks the error digest and
 * gives the user nothing to act on. This catches it, logs it, and gives the user
 * a real way forward.
 *
 * Deliberately does not tell the user their data is safe. A render error can
 * follow a successful write, and a page that crashes mid-submit is exactly when
 * a duplicate is most likely. Claiming otherwise is a guess presented as fact.
 *
 * `global-error` replaces the root layout, so it must render its own
 * <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort correlation only. `error.digest` is the reliable key: Next
    // prints the same digest in the server log for the originating render
    // error. There is no request id available here — the one the proxy sets is
    // a response header, and a client component that replaced the root layout
    // cannot read it. The meta tag is probed in case one is ever emitted, but
    // it is normally absent and the value will be null. This log is therefore
    // evidence for client-side errors only; without error tracking wired up,
    // server-rendered failures are found via the digest, not this line.
    console.error(
      JSON.stringify({
        level: "error",
        event: "unhandled_render_error",
        message: error.message,
        digest: error.digest ?? null,
        requestId:
          typeof document === "undefined"
            ? null
            : document.querySelector("meta[name=x-request-id]")?.getAttribute("content") ?? null,
      })
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#0b1120",
          color: "#e2e8f0",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 0.75rem", lineHeight: 1.6, color: "#94a3b8" }}>
            An unexpected error interrupted this page. We can&rsquo;t tell from here whether anything
            was saved.
          </p>
          <p style={{ margin: "0 0 1rem", lineHeight: 1.6, color: "#94a3b8" }}>
            If you were submitting something, check it is still there before retrying so you
            don&rsquo;t create a duplicate.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.8125rem", color: "#64748b" }}>
              Reference for support: <code style={{ color: "#94a3b8" }}>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.625rem 1.125rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontSize: "0.9375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
