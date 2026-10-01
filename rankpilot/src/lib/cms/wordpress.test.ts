import { describe, expect, it, vi } from "vitest";
import {
  wordpressConfig,
  parseFixPayload,
  backupPost,
  applyPost,
  verifyPost,
  restorePost,
} from "./wordpress";

const CONFIG = {
  baseUrl: "https://blog.example.com",
  username: "admin",
  appPassword: "abcd efgh ijkl mnop qrst uvwx",
};

describe("wordpressConfig", () => {
  it("fails closed when any credential is missing", () => {
    expect("problem" in wordpressConfig({})).toBe(true);
    expect("problem" in wordpressConfig({ WORDPRESS_BASE_URL: "https://x.com" })).toBe(true);
    expect("problem" in wordpressConfig({ WORDPRESS_BASE_URL: "https://x.com", WORDPRESS_USERNAME: "a" })).toBe(true);
  });

  it("accepts a complete https configuration", () => {
    const r = wordpressConfig({
      WORDPRESS_BASE_URL: "https://blog.example.com",
      WORDPRESS_USERNAME: "admin",
      WORDPRESS_APP_PASSWORD: "pw",
    });
    expect("config" in r).toBe(true);
    if ("config" in r) expect(r.config.baseUrl).toBe("https://blog.example.com");
  });

  it("refuses a plain http base URL, so an app password is never sent unencrypted", () => {
    const r = wordpressConfig({
      WORDPRESS_BASE_URL: "http://blog.example.com",
      WORDPRESS_USERNAME: "admin",
      WORDPRESS_APP_PASSWORD: "pw",
    });
    expect("problem" in r).toBe(true);
    if ("problem" in r) expect(r.problem).toMatch(/https/);
  });

  it("rejects a base URL that is not a URL at all", () => {
    const r = wordpressConfig({ WORDPRESS_BASE_URL: "not a url", WORDPRESS_USERNAME: "a", WORDPRESS_APP_PASSWORD: "b" });
    expect("problem" in r).toBe(true);
  });
});

describe("parseFixPayload", () => {
  it("accepts a post id + content", () => {
    const r = parseFixPayload({ postId: 42, content: "<p>hi</p>" });
    expect(r).toEqual({ payload: { postId: 42, content: "<p>hi</p>" } });
  });

  it("keeps an optional title", () => {
    const r = parseFixPayload({ postId: 1, content: "x", title: "New" });
    expect("payload" in r && r.payload.title).toBe("New");
  });

  it("rejects a non-integer or non-positive post id", () => {
    expect("problem" in parseFixPayload({ postId: 0, content: "x" })).toBe(true);
    expect("problem" in parseFixPayload({ postId: "42", content: "x" })).toBe(true);
    expect("problem" in parseFixPayload({ postId: 1.5, content: "x" })).toBe(true);
  });

  it("rejects empty or non-string content", () => {
    expect("problem" in parseFixPayload({ postId: 1, content: "" })).toBe(true);
    expect("problem" in parseFixPayload({ postId: 1 })).toBe(true);
  });

  it("rejects a non-object payload", () => {
    expect("problem" in parseFixPayload(null)).toBe(true);
    expect("problem" in parseFixPayload("nope")).toBe(true);
  });
});

describe("WordPress REST calls", () => {
  const post = {
    id: 7,
    title: { raw: "Old title" },
    content: { raw: "<p>old body</p>" },
    status: "publish",
    modified_gmt: "2026-01-01T00:00:00Z",
  };

  const makeFetch = (body: unknown, status = 200) =>
    vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(JSON.stringify(body), { status })
    );

  it("backups a post by reading it with context=edit", async () => {
    const f = makeFetch(post);
    const snap = await backupPost(CONFIG, 7, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://blog.example.com/wp-json/wp/v2/posts/7?context=edit");
    expect(new Headers(init!.headers).get("authorization")).toMatch(/^Basic /);
    expect(snap).toEqual({
      id: 7,
      title: "Old title",
      content: "<p>old body</p>",
      status: "publish",
      modifiedGmt: "2026-01-01T00:00:00Z",
    });
  });

  it("applies a fix by POSTing the new content", async () => {
    const f = makeFetch({ ...post, content: { raw: "<p>new body</p>" } });
    const applied = await applyPost(CONFIG, { postId: 7, content: "<p>new body</p>" }, f as unknown as typeof fetch);
    const [, init] = f.mock.calls[0];
    expect(init!.method).toBe("POST");
    expect(JSON.parse(String(init!.body))).toEqual({ content: "<p>new body</p>" });
    expect(applied.content).toBe("<p>new body</p>");
  });

  it("throws with the status when WordPress refuses", async () => {
    const f = makeFetch({}, 401);
    await expect(backupPost(CONFIG, 7, f as unknown as typeof fetch)).rejects.toThrow(/401/);
  });

  it("verify reports content_drift instead of claiming success", async () => {
    const f = makeFetch({ ...post, content: { raw: "<p>someone edited this</p>" } });
    const verdict = await verifyPost(CONFIG, { postId: 7, content: "<p>new body</p>" }, f as unknown as typeof fetch);
    expect(verdict.verified).toBe(false);
    expect(verdict.reason).toBe("content_drift");
  });

  it("verify reports title_drift separately", async () => {
    const f = makeFetch({ ...post, content: { raw: "<p>new body</p>" }, title: { raw: "Someone else's title" } });
    const verdict = await verifyPost(
      CONFIG,
      { postId: 7, content: "<p>new body</p>", title: "New title" },
      f as unknown as typeof fetch
    );
    expect(verdict.verified).toBe(false);
    expect(verdict.reason).toBe("title_drift");
  });

  it("verify passes when the live post matches the fix", async () => {
    const f = makeFetch({ ...post, content: { raw: "<p>new body</p>" } });
    const verdict = await verifyPost(CONFIG, { postId: 7, content: "<p>new body</p>" }, f as unknown as typeof fetch);
    expect(verdict.verified).toBe(true);
    expect(verdict.reason).toBeUndefined();
  });

  it("restore writes the backup content back", async () => {
    const f = makeFetch(post);
    const snapshot = await backupPost(CONFIG, 7, f as unknown as typeof fetch);
    const restoreFetch = makeFetch(post);
    await restorePost(CONFIG, snapshot, restoreFetch as unknown as typeof fetch);
    const [url, init] = restoreFetch.mock.calls[0];
    expect(url).toBe("https://blog.example.com/wp-json/wp/v2/posts/7?context=edit");
    expect(init!.method).toBe("POST");
    expect(JSON.parse(String(init!.body))).toEqual({
      content: "<p>old body</p>",
      title: "Old title",
    });
  });
});