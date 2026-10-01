import { z } from "zod";

const UNAVAIL = "Data unavailable.";

const effort = z.enum(["low", "medium", "high"]);
const impact = z.enum(["low", "medium", "high"]);
const change = z.object({ field: z.string(), before: z.string(), after: z.string(), why: z.string() });

/** Deterministic, data-grounded fallbacks. They only ever use what is in the context pack. */

function issueTitles(ctx: unknown): Array<{ title: string; why: string; recommendation: string; severity: string }> {
  const c = ctx as { topIssues?: Array<Record<string, unknown>> };
  return (c?.topIssues ?? []).map((i) => ({
    title: String(i.title ?? "Untitled issue"),
    why: String(i.why_it_matters ?? ""),
    recommendation: String(i.recommendation ?? ""),
    severity: String(i.severity ?? "medium"),
  }));
}

const TASKS = {
  "content.generate": {
    task: "content.generate",
    schema: z.object({
      title: z.string(),
      metaDescription: z.string(),
      h1: z.string(),
      outline: z.array(z.string()),
      article: z.string(),
      faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
      cta: z.string(),
      internalLinkIdeas: z.array(z.string()),
    }),
    fallback: (ctx: unknown) => {
      const c = ctx as { brief?: Record<string, unknown>; keywords?: Array<Record<string, unknown>> };
      const brief = (c?.brief ?? {}) as Record<string, string>;
      const title = brief.title || brief.target || "Untitled draft";
      const keywords = (c?.keywords ?? []).slice(0, 8).map((k) => String(k.term));
      const outline = keywords.length
        ? ["Introduction", ...keywords.map((k) => `How ${k} works`), "FAQ"]
        : ["Introduction", "Key points", "FAQ"];
      return {
        title,
        metaDescription: `${title} — draft generated from your brief. Rewrite before publishing.`,
        h1: title,
        outline,
        article: [
          `# ${title}`,
          "",
          brief.goal ? `Goal: ${brief.goal}` : "",
          "",
          "This is a rules-generated skeleton. Add your product facts, proof and links — no statistics were invented here.",
          "",
          ...outline.map((h) => `## ${h}\n\n${UNAVAIL}`),
        ].join("\n"),
        faqs: outline.slice(-1).map(() => ({
          question: `What is ${title}?`,
          answer: `${UNAVAIL} Draft from brief: ${brief.goal ?? ""}`.trim(),
        })),
        cta: brief.cta || "Talk to us to learn more.",
        internalLinkIdeas: (c?.keywords ?? []).slice(0, 5).map((k) => String(k.recommended_url ?? "")),
      };
    },
 },

  "content.optimize": {
    task: "content.optimize",
    schema: z.object({ analysis: z.string(), rewritten: z.string(), changes: z.array(change) }),
    fallback: (ctx: unknown) => {
      const c = ctx as { content?: { title?: string; body?: string }; topIssues?: Array<Record<string, unknown>> };
      const body = String(c?.content?.body ?? "");
      const issues = issueTitles(ctx);
      return {
        analysis: issues.length
          ? `Observed issues to address first: ${issues.slice(0, 5).map((i) => i.title).join("; ")}.`
          : "No open issues in context. Rules output leaves the text unchanged.",
        rewritten: body || UNAVAIL,
        changes: [],
      };
    },
 },

  "question.answer": {
    task: "question.answer",
    schema: z.object({ answer: z.string(), schemaType: z.string(), rationale: z.string() }),
    fallback: (ctx: unknown) => {
      const c = ctx as { questions?: Array<Record<string, unknown>>; page?: { text_sample?: string } };
      const q = (c?.questions ?? [])[0];
      const draft = q?.recommended_answer ? String(q.recommended_answer) : null;
      return {
        answer: draft ?? `${UNAVAIL} — no crawled answer text for this question yet.`,
        schemaType: "FAQPage",
        rationale: "Rules fallback used crawled question data only.",
      };
    },
 },

  "geo.recommendations": {
    task: "geo.recommendations",
    schema: z.object({
      recommendations: z.array(z.object({ title: z.string(), detail: z.string(), effort, why: z.string() })),
    }),
    fallback: (ctx: unknown) => {
      const issues = issueTitles(ctx);
      const recs = issues.slice(0, 6).map((i) => ({
        title: i.title,
        detail: i.recommendation || i.why || "Address this issue on the affected pages.",
        effort: (i.severity === "critical" || i.severity === "high" ? "medium" : "low") as "low" | "medium" | "high",
        why: i.why || "Improves extractability for answer engines.",
      }));
      return {
        recommendations: recs.length
          ? recs
          : [{ title: "Add entity context", detail: "Add Organization/About schema with consistent entity facts.", effort: "low", why: "Helps AI engines identify your brand." }],
      };
    },
 },

  "issue.fix": {
    task: "issue.fix",
    schema: z.object({ suggestion: z.string(), rationale: z.string() }),
    fallback: (ctx: unknown) => {
      const c = ctx as { issue?: Record<string, unknown> };
      return {
        suggestion: String(c?.issue?.recommendation || UNAVAIL),
        rationale: String(c?.issue?.why_it_matters || "Rules fallback: recommendation from the issue record."),
      };
    },
 },

  "social.ideas": {
    task: "social.ideas",
    schema: z.object({
      ideas: z.array(
        z.object({ category: z.string(), title: z.string(), hook: z.string(), painPoint: z.string(), emotionalAngle: z.string(), format: z.string(), value: z.string(), cta: z.string() })
      ),
    }),
    fallback: (ctx: unknown) => {
      const c = ctx as { brief?: Record<string, string> };
      const b = c?.brief ?? {};
      const topic = b.objective || b.goal || b.name || "your product";
      const cats = ["Pain point", "Myth-busting", "How-to", "Social proof", "Behind the scenes"];
      return {
        ideas: cats.map((category, i) => ({
          category,
          title: `${category}: ${topic}`,
          hook: `Struggling with ${topic}?`,
          painPoint: topic,
          emotionalAngle: ["Frustration", "Curiosity", "Confidence", "Trust", "Belonging"][i] ?? "Clarity",
          format: i % 2 === 0 ? "carousel" : "reel",
          value: `Explain one concrete way ${topic} gets easier.`,
          cta: "Follow for the next tip.",
        })),
      };
    },
 },

  "social.hooks": {
    task: "social.hooks",
    schema: z.object({ hooks: z.array(z.object({ text: z.string(), style: z.string() })) }),
    fallback: (ctx: unknown) => {
      const c = ctx as { idea?: { title?: string; hook?: string } };
      const t = c?.idea?.title || "this topic";
      return {
        hooks: [
          { text: c?.idea?.hook || `${t} — here's what nobody tells you.`, style: "direct" },
          { text: `I was wrong about ${t}.`, style: "contrarian" },
          { text: `3 things I learned about ${t}.`, style: "list" },
        ],
      };
    },
 },

  "social.script": {
    task: "social.script",
    schema: z.object({
      hook: z.string(),
      scenes: z.array(z.object({ start: z.number(), end: z.number(), visual: z.string(), voiceover: z.string() })),
      voiceover: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
    }),
    fallback: (ctx: unknown) => {
      const c = ctx as { idea?: { title?: string; hook?: string; value?: string; cta?: string } };
      const title = c?.idea?.title || "the topic";
      const dur = 30;
      return {
        hook: c?.idea?.hook || `${title}, in 30 seconds.`,
        scenes: [
          { start: 0, end: 3, visual: "Hook text on screen", voiceover: c?.idea?.hook || `${title}.` },
          { start: 3, end: 24, visual: "Show the process step by step", voiceover: c?.idea?.value || `Explain ${title} with a real example.` },
          { start: 24, end: dur, visual: "CTA card", voiceover: c?.idea?.cta || "Follow for more." },
        ],
        voiceover: `${c?.idea?.hook || title}. ${c?.idea?.value || ""} ${c?.idea?.cta || ""}`.trim(),
        caption: `${title}`,
        hashtags: ["#seo", "#growth"],
      };
    },
 },

  "social.captions": {
    task: "social.captions",
    schema: z.object({ captions: z.array(z.object({ platform: z.string(), text: z.string(), hashtags: z.array(z.string()) })) }),
    fallback: (ctx: unknown) => {
      const c = ctx as { post?: { topic?: string; hook?: string; cta?: string }; platform?: string };
      const topic = c?.post?.topic || "this post";
      return {
        captions: [
          { platform: String(c?.platform || "linkedin"), text: `${c?.post?.hook || topic}\n\n${c?.post?.cta || "Thoughts?"}`, hashtags: ["#seo", "#growth"] },
        ],
      };
    },
 },

  "copilot.answer": {
    task: "copilot.answer",
    schema: z.object({
      observed: z.array(z.string()),
      interpretation: z.string(),
      recommendation: z.string(),
      missingData: z.array(z.string()),
    }),
    fallback: (ctx: unknown) => {
      const c = ctx as {
        score?: { overall?: number } | string;
        topIssues?: Array<Record<string, unknown>>;
        pagesSummary?: Record<string, number> | string;
        keywords?: Array<Record<string, unknown>>;
      };
      const observed: string[] = [];
      if (typeof c?.score !== "string" && c?.score?.overall !== undefined) observed.push(`Overall score: ${c.score.overall}/100.`);
      const issues = c?.topIssues ?? [];
      if (issues.length) observed.push(`${issues.length} open critical/high issues, top: ${issues[0].title}.`);
      if (typeof c?.pagesSummary !== "string" && c?.pagesSummary?.pages !== undefined) observed.push(`${c.pagesSummary.pages} pages crawled.`);
      if (c?.keywords?.length) observed.push(`${c.keywords.length} keywords tracked.`);
      const missing: string[] = [];
      if (!observed.length) missing.push("crawl data for this website");
      if (typeof c?.score === "string") missing.push("latest score");
      return {
        observed: observed.length ? observed : [UNAVAIL],
        interpretation: observed.length
          ? `Open issues concentrate in ${issues[0]?.category ?? "the crawl"}; those block the biggest score gains.`
          : "Not enough observed data to interpret.",
        recommendation: issues.length
          ? `Fix "${issues[0].title}" first — it is ${issues[0].severity} severity.`
          : "Run a crawl to get tailored recommendations.",
        missingData: missing,
      };
    },
 },

  "agent.priorities": {
    task: "agent.priorities",
    schema: z.object({
      priorities: z.array(z.object({ title: z.string(), why: z.string(), effort, impact, basedOn: z.string() })),
    }),
    fallback: (ctx: unknown) => {
      const issues = issueTitles(ctx);
      return {
        priorities: issues.slice(0, 5).map((i) => ({
          title: i.title,
          why: i.why || i.recommendation,
          effort: (i.severity === "critical" ? "medium" : "low") as "low" | "medium" | "high",
          impact: (i.severity === "critical" || i.severity === "high" ? "high" : "medium") as "low" | "medium" | "high",
          basedOn: `Observed crawl issue (${i.severity})`,
        })),
      };
    },
 },

  "content.repurpose": {
    task: "content.repurpose",
    schema: z.object({ assets: z.array(z.object({ format: z.string(), title: z.string(), body: z.string() })) }),
    fallback: (ctx: unknown) => {
      const c = ctx as { content?: { title?: string; body?: string }; formats?: string[] };
      const title = c?.content?.title || "Untitled";
      const body = String(c?.content?.body ?? "");
      const excerpt = body.split(/\n+/).slice(0, 3).join(" ") || UNAVAIL;
      return {
        assets: (c?.formats ?? ["linkedin"]).map((format) => ({
          format,
          title: `${title} (${format})`,
          body: excerpt,
        })),
      };
    },
 },
};

export type TaskName = keyof typeof TASKS;
export const getTask = (name: TaskName) => TASKS[name];
export const TASK_NAMES = Object.keys(TASKS) as TaskName[];
