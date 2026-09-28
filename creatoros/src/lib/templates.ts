import { all, run, newId, nowIso } from "@/lib/db/db";
import { getLimits } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";

export const TEMPLATE_CATEGORIES = ["social", "business", "marketing", "creator", "pmo", "career", "ai"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateBlock {
  type: "profile" | "bio" | "link" | "product" | "booking" | "email_capture" | "cta" | "social";
  payload: Record<string, string>;
}

export interface TemplateSpec {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  premium: boolean;
  theme: { accent: string; bg: string; radius: string };
  blocks: TemplateBlock[];
}

export const PREMIUM_PLANS = new Set(["creator", "pro", "business"]);

export const TEMPLATE_CATALOG: TemplateSpec[] = [
  {
    id: "tmpl-social-linktree",
    name: "Link-in-Bio Starter",
    category: "social",
    description: "The classic social hub: your profile, a few key links and your social icons.",
    premium: false,
    theme: { accent: "#7c3aed", bg: "#ffffff", radius: "12" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Creator · Educator · Podcaster" } },
      { type: "bio", payload: { text: "Welcome to my corner of the internet. Tap around to see what I make." } },
      { type: "link", payload: { title: "My latest YouTube video", url: "https://youtube.com/@you" } },
      { type: "link", payload: { title: "Newest Instagram post", url: "https://instagram.com/you" } },
      { type: "social", payload: {} },
    ],
  },
  {
    id: "tmpl-social-creatorhub",
    name: "Solo Creator Hub",
    category: "social",
    description: "Turn casual followers into fans with a strong CTA and fresh content links.",
    premium: false,
    theme: { accent: "#0ea5e9", bg: "#f8fafc", radius: "16" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "I make videos about productivity" } },
      { type: "bio", payload: { text: "Weekly videos, monthly deep-dives, daily notes. Here is everything in one place." } },
      { type: "link", payload: { title: "Watch the latest video", url: "https://youtube.com/@you" } },
      { type: "link", payload: { title: "Join the community", url: "https://discord.gg/you" } },
      { type: "link", payload: { title: "Support the channel", url: "https://ko-fi.com/you" } },
      { type: "cta", payload: { text: "Subscribe on YouTube", url: "https://youtube.com/@you" } },
      { type: "social", payload: {} },
    ],
  },
  {
    id: "tmpl-social-viralkit",
    name: "Viral Content Kit",
    category: "social",
    description: "A high-converting layout for short-form creators launching a newsletter.",
    premium: true,
    theme: { accent: "#ef4444", bg: "#0f172a", radius: "20" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Short-form · Trends · Growth" } },
      { type: "bio", payload: { text: "I study what goes viral so you don't have to. Get the breakdown in your inbox." } },
      { type: "email_capture", payload: { title: "Get the weekly trend report", buttonLabel: "Subscribe free", destination: "bio" } },
      { type: "link", payload: { title: "TikTok", url: "https://tiktok.com/@you" } },
      { type: "link", payload: { title: "Instagram Reels", url: "https://instagram.com/you" } },
      { type: "link", payload: { title: "Featured in Forbes", url: "https://example.com" } },
      { type: "cta", payload: { text: "Join 10k subscribers", url: "https://substack.com/@you" } },
      { type: "social", payload: {} },
    ],
  },
  {
    id: "tmpl-business-consultant",
    name: "Consultant Landing",
    category: "business",
    description: "Establish authority and start the conversation with a clear call to action.",
    premium: false,
    theme: { accent: "#0f766e", bg: "#ffffff", radius: "10" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Strategy Consultant" } },
      { type: "bio", payload: { text: "I help founders go from product-market fit to predictable revenue." } },
      { type: "link", payload: { title: "Book a strategy call", url: "https://example.com/book" } },
      { type: "email_capture", payload: { title: "Get the founder playbook", buttonLabel: "Download", destination: "bio" } },
      { type: "cta", payload: { text: "Work with me", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-business-agency",
    name: "Agency Growth Page",
    category: "business",
    description: "A clean B2B landing that routes clients to your calendar and intake form.",
    premium: false,
    theme: { accent: "#1d4ed8", bg: "#f1f5f9", radius: "8" },
    blocks: [
      { type: "profile", payload: { title: "Studio Name", subtitle: "Design & Growth" } },
      { type: "bio", payload: { text: "We ship websites and campaigns that turn visitors into revenue." } },
      { type: "link", payload: { title: "See our work", url: "https://example.com/portfolio" } },
      { type: "link", payload: { title: "Book a discovery call", url: "https://example.com/book" } },
      { type: "link", payload: { title: "Case studies", url: "https://example.com/case-studies" } },
      { type: "email_capture", payload: { title: "Get our monthly growth memo", buttonLabel: "Subscribe", destination: "bio" } },
      { type: "cta", payload: { text: "Start a project", url: "https://example.com/contact" } },
    ],
  },
  {
    id: "tmpl-business-agentsuite",
    name: "Premium Agency Suite",
    category: "business",
    description: "Executive-grade layout with a full funnel for premium B2B clients.",
    premium: true,
    theme: { accent: "#b45309", bg: "#18181b", radius: "12" },
    blocks: [
      { type: "profile", payload: { title: "Agency Name", subtitle: "Fractional CMO Services" } },
      { type: "bio", payload: { text: "Senior marketing leadership for brands doing $1M+ without the full-time hire." } },
      { type: "link", payload: { title: "Services & pricing", url: "https://example.com/services" } },
      { type: "link", payload: { title: "Client results", url: "https://example.com/results" } },
      { type: "link", payload: { title: "Book a strategy session", url: "https://example.com/book" } },
      { type: "email_capture", payload: { title: "The Operator's Brief", buttonLabel: "Get it", destination: "bio" } },
      { type: "cta", payload: { text: "Talk to us", url: "https://example.com/book" } },
      { type: "social", payload: {} },
    ],
  },
  {
    id: "tmpl-marketing-launch",
    name: "Product Launch",
    category: "marketing",
    description: "Build anticipation and convert pre-sales into an email list.",
    premium: false,
    theme: { accent: "#d97706", bg: "#fffbeb", radius: "18" },
    blocks: [
      { type: "profile", payload: { title: "Product Name", subtitle: "Launching soon" } },
      { type: "bio", payload: { text: "The simplest way to [outcome]. Join the waitlist, grab a launch deal, tell a friend." } },
      { type: "email_capture", payload: { title: "Be first in line", buttonLabel: "Join the waitlist", destination: "bio" } },
      { type: "link", payload: { title: "Watch the demo", url: "https://youtube.com/@you" } },
      { type: "cta", payload: { text: "Get launch pricing", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-marketing-newsletter",
    name: "Newsletter Funnel",
    category: "marketing",
    description: "One page built to do one job: grow your subscriber list.",
    premium: false,
    theme: { accent: "#059669", bg: "#ffffff", radius: "14" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Newsletter · Marketing" } },
      { type: "bio", payload: { text: "A weekly essay on marketing that actually moves revenue. No fluff, ever." } },
      { type: "email_capture", payload: { title: "Read the last issue", buttonLabel: "Subscribe", destination: "bio" } },
      { type: "link", payload: { title: "Best issue: pricing", url: "https://example.com/best" } },
      { type: "link", payload: { title: "Sponsor the newsletter", url: "https://example.com/sponsor" } },
      { type: "cta", payload: { text: "Subscribe free", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-marketing-leadmagnet",
    name: "Lead Magnets",
    category: "marketing",
    description: "Stack free tools and guides to capture contacts at every touchpoint.",
    premium: true,
    theme: { accent: "#4f46e5", bg: "#eef2ff", radius: "20" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Free resources, zero spam" } },
      { type: "bio", payload: { text: "Pick what you need: templates, checklists, calculators. Everything is free." } },
      { type: "email_capture", payload: { title: "Get the 54-page content engine", buttonLabel: "Send it to me", destination: "bio" } },
      { type: "link", payload: { title: "Free social media calendar", url: "https://example.com/calendar" } },
      { type: "link", payload: { title: "Pricing calculator", url: "https://example.com/calc" } },
      { type: "link", payload: { title: "Brand audit checklist", url: "https://example.com/audit" } },
      { type: "cta", payload: { text: "See all freebies", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-creator-course",
    name: "Course Creator",
    category: "creator",
    description: "A landing page for your course with a clear enrollment action.",
    premium: false,
    theme: { accent: "#8b5cf6", bg: "#ffffff", radius: "16" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "I teach [topic]" } },
      { type: "bio", payload: { text: "Learn [skill] in 4 weeks with real projects and weekly live calls." } },
      { type: "link", payload: { title: "Enroll in the course", url: "https://example.com/enroll" } },
      { type: "email_capture", payload: { title: "Download the free syllabus", buttonLabel: "Get it", destination: "bio" } },
      { type: "cta", payload: { text: "Start learning", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-creator-coach",
    name: "Coach Call Card",
    category: "creator",
    description: "A digital business card that routes straight to your booking calendar.",
    premium: false,
    theme: { accent: "#0891b2", bg: "#ecfeff", radius: "9999" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "1:1 Coaching" } },
      { type: "bio", payload: { text: "I've helped 200+ creators turn their audience into income. Book a session." } },
      { type: "link", payload: { title: "Book a free intro call", url: "https://example.com/book" } },
      { type: "link", payload: { title: "What clients say", url: "https://example.com/testimonials" } },
      { type: "email_capture", payload: { title: "Get the creator playbook", buttonLabel: "Download", destination: "bio" } },
      { type: "cta", payload: { text: "Book now", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-creator-digitalkit",
    name: "Digital Creator Kit",
    category: "creator",
    description: "The full creator economy stack: products, list and socials in one premium page.",
    premium: true,
    theme: { accent: "#ec4899", bg: "#fdf2f8", radius: "24" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Creator · Products · Courses" } },
      { type: "bio", payload: { text: "Everything I make, in one place. Templates, courses and presets for creators." } },
      { type: "link", payload: { title: "Browse the template shop", url: "https://example.com/shop" } },
      { type: "link", payload: { title: "My masterclass", url: "https://example.com/class" } },
      { type: "link", payload: { title: "Lightroom presets", url: "https://example.com/presets" } },
      { type: "link", payload: { title: "Free resources", url: "https://example.com/free" } },
      { type: "email_capture", payload: { title: "Join the creator digest", buttonLabel: "Subscribe", destination: "bio" } },
      { type: "cta", payload: { text: "Visit the shop", url: "https://example.com" } },
      { type: "social", payload: {} },
    ],
  },
  {
    id: "tmpl-pmo-lead",
    name: "PMO Lead Page",
    category: "pmo",
    description: "Showcase your program leadership and open the door for new mandates.",
    premium: false,
    theme: { accent: "#334155", bg: "#f8fafc", radius: "10" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Program Manager · PMO" } },
      { type: "bio", payload: { text: "I lead cross-functional programs that ship on time and on budget." } },
      { type: "link", payload: { title: "My approach", url: "https://example.com/approach" } },
      { type: "link", payload: { title: "Selected outcomes", url: "https://example.com/outcomes" } },
      { type: "email_capture", payload: { title: "Get the program kickoff template", buttonLabel: "Download", destination: "bio" } },
      { type: "cta", payload: { text: "Let's talk", url: "https://example.com/contact" } },
    ],
  },
  {
    id: "tmpl-pmo-teamhub",
    name: "Team Resource Hub",
    category: "pmo",
    description: "A single source of truth for your team's docs, tools and rituals.",
    premium: false,
    theme: { accent: "#0369a1", bg: "#ffffff", radius: "8" },
    blocks: [
      { type: "profile", payload: { title: "Team Name", subtitle: "PMO Resource Hub" } },
      { type: "bio", payload: { text: "Everything the team needs: roadmaps, rituals, templates and key links." } },
      { type: "link", payload: { title: "Program roadmap", url: "https://example.com/roadmap" } },
      { type: "link", payload: { title: "Meeting cadence", url: "https://example.com/rituals" } },
      { type: "link", payload: { title: "Templates library", url: "https://example.com/templates" } },
      { type: "link", payload: { title: "Status dashboard", url: "https://example.com/status" } },
    ],
  },
  {
    id: "tmpl-pmo-command",
    name: "Ops Command Center",
    category: "pmo",
    description: "Executive-facing operations hub for org-wide visibility.",
    premium: true,
    theme: { accent: "#e11d48", bg: "#18181b", radius: "12" },
    blocks: [
      { type: "profile", payload: { title: "Ops Command", subtitle: "Portfolio Command Center" } },
      { type: "bio", payload: { text: "Trusted operations intel: portfolio health, delivery status and exec updates." } },
      { type: "link", payload: { title: "Portfolio health", url: "https://example.com/health" } },
      { type: "link", payload: { title: "Delivery dashboard", url: "https://example.com/delivery" } },
      { type: "link", payload: { title: "Risk register", url: "https://example.com/risks" } },
      { type: "link", payload: { title: "Exec weekly brief", url: "https://example.com/brief" } },
      { type: "email_capture", payload: { title: "Ops community", buttonLabel: "Join beta", destination: "bio" } },
    ],
  },
  {
    id: "tmpl-career-dev",
    name: "Developer Landing",
    category: "career",
    description: "A sharp links page for devs: repos, blog, resume and current work.",
    premium: false,
    theme: { accent: "#22c55e", bg: "#09090b", radius: "10" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Full-stack Engineer" } },
      { type: "bio", payload: { text: "I build fast, reliable web products. Currently shipping at [company]." } },
      { type: "link", payload: { title: "GitHub", url: "https://github.com/you" } },
      { type: "link", payload: { title: "My blog", url: "https://example.com/blog" } },
      { type: "link", payload: { title: "Resume", url: "https://example.com/resume" } },
      { type: "cta", payload: { text: "Contact me", url: "https://example.com/contact" } },
    ],
  },
  {
    id: "tmpl-career-portfolio",
    name: "Portfolio Starter",
    category: "career",
    description: "Clean, minimal showcase for designers and builders looking for work.",
    premium: false,
    theme: { accent: "#6366f1", bg: "#ffffff", radius: "16" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Product Designer" } },
      { type: "bio", payload: { text: "I design calm, useful products. Here are things I've made and where to find me." } },
      { type: "link", payload: { title: "Case studies", url: "https://example.com/work" } },
      { type: "link", payload: { title: "Dribbble", url: "https://dribbble.com/you" } },
      { type: "link", payload: { title: "About me", url: "https://example.com/about" } },
      { type: "email_capture", payload: { title: "Open to work", buttonLabel: "Get in touch", destination: "bio" } },
      { type: "social", payload: {} },
    ],
  },
  {
    id: "tmpl-career-senior",
    name: "Senior Portfolio Pro",
    category: "career",
    description: "Authority-led portfolio with proof, content and a consulting path.",
    premium: true,
    theme: { accent: "#2563eb", bg: "#0f172a", radius: "18" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Staff Engineer · Speaker" } },
      { type: "bio", payload: { text: "15 years shipping systems at scale. I write, speak and consult on architecture." } },
      { type: "link", payload: { title: "Selected work", url: "https://example.com/work" } },
      { type: "link", payload: { title: "Talks & conference calendar", url: "https://example.com/talks" } },
      { type: "link", payload: { title: "Everything I've written", url: "https://example.com/blog" } },
      { type: "email_capture", payload: { title: "Architecture advisory", buttonLabel: "Book a slot", destination: "bio" } },
      { type: "cta", payload: { text: "Hire me as an advisor", url: "https://example.com/advisory" } },
    ],
  },
  {
    id: "tmpl-ai-founder",
    name: "AI Founder Page",
    category: "ai",
    description: "A focused link page for an AI product with early-adopter signup.",
    premium: false,
    theme: { accent: "#a855f7", bg: "#0a0a0f", radius: "14" },
    blocks: [
      { type: "profile", payload: { title: "Product Name", subtitle: "AI for [audience]" } },
      { type: "bio", payload: { text: "An AI copilot that [outcome]. Private beta open for the first 500." } },
      { type: "email_capture", payload: { title: "Get early access", buttonLabel: "Join the beta", destination: "bio" } },
      { type: "link", payload: { title: "Read the launch post", url: "https://example.com/launch" } },
      { type: "link", payload: { title: "How it works", url: "https://example.com/how" } },
      { type: "cta", payload: { text: "Request access", url: "https://example.com" } },
    ],
  },
  {
    id: "tmpl-ai-prompts",
    name: "Prompt Portfolio",
    category: "ai",
    description: "Sell and share prompts with demos and testimonials.",
    premium: false,
    theme: { accent: "#14b8a6", bg: "#f0fdfa", radius: "12" },
    blocks: [
      { type: "profile", payload: { title: "Your name", subtitle: "Prompt Engineer" } },
      { type: "bio", payload: { text: "Production-ready prompts for teams shipping with AI. Tested, documented, reusable." } },
      { type: "link", payload: { title: "Browse all prompts", url: "https://example.com/prompts" } },
      { type: "link", payload: { title: "Free starter pack", url: "https://example.com/free" } },
      { type: "email_capture", payload: { title: "Get a prompt every week", buttonLabel: "Subscribe", destination: "bio" } },
      { type: "cta", payload: { text: "Hire me", url: "https://example.com/contact" } },
    ],
  },
  {
    id: "tmpl-ai-agency",
    name: "AI Agency Suite",
    category: "ai",
    description: "A premium funnel for selling AI automation services to clients.",
    premium: true,
    theme: { accent: "#06b6d4", bg: "#082f49", radius: "20" },
    blocks: [
      { type: "profile", payload: { title: "Studio Name", subtitle: "AI Automation for SMBs" } },
      { type: "bio", payload: { text: "We build AI agents and automations that cut hours off your operations." } },
      { type: "link", payload: { title: "Automation playbooks", url: "https://example.com/playbooks" } },
      { type: "link", payload: { title: "Client stories", url: "https://example.com/stories" } },
      { type: "email_capture", payload: { title: "Free automation audit", buttonLabel: "Get my audit", destination: "bio" } },
      { type: "cta", payload: { text: "Book a demo", url: "https://example.com/book" } },
      { type: "social", payload: {} },
    ],
  },
];

export function listTemplates(category?: string, q?: string): TemplateSpec[] {
  const query = (q || "").trim().toLowerCase();
  return TEMPLATE_CATALOG.filter((t) => {
    if (category && t.category !== category) return false;
    if (query && !`${t.name} ${t.description} ${t.category}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function getTemplate(id: string): TemplateSpec | undefined {
  return TEMPLATE_CATALOG.find((t) => t.id === id);
}

export function templateUsageCount(tenantId: string): number {
  return getUsage(tenantId, "bio_pages");
}

export function applyTemplate(opts: {
  tenantId: string;
  profileId: string;
  plan: string;
  templateId: string;
  title?: string;
  slug?: string;
}): { ok: true; pageId: string } | { ok: false; code: "not_found" | "premium" | "quota"; message: string } {
  const spec = getTemplate(opts.templateId);
  if (!spec) return { ok: false, code: "not_found", message: "Template not found" };
  if (spec.premium && !PREMIUM_PLANS.has(opts.plan)) {
    return { ok: false, code: "premium", message: "This template requires the Creator plan or higher." };
  }
  const limits = getLimits(opts.plan);
  if (limits.bioPages !== -1 && templateUsageCount(opts.tenantId) >= limits.bioPages) {
    return { ok: false, code: "quota", message: `Bio page limit reached for the ${opts.plan} plan. Upgrade to create more.` };
  }

  const pageId = newId("bio");
  const slug = uniqueSlug(opts.profileId, opts.slug, spec.name);
  run(
    "INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, published, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)",
    pageId,
    opts.tenantId,
    opts.profileId,
    slug,
    opts.title || spec.name,
    JSON.stringify(spec.theme),
    nowIso(),
    nowIso()
  );

  for (const [i, b] of spec.blocks.entries()) {
    run(
      "INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
      newId("blk"),
      opts.tenantId,
      pageId,
      b.type,
      JSON.stringify(b.payload),
      i,
      nowIso(),
      nowIso()
    );
  }

  bumpUsage(opts.tenantId, "bio_pages");
  return { ok: true, pageId };
}

/** Pick a bio page slug that doesn't collide with the profile's existing pages. */
function uniqueSlug(profileId: string, preferred: string | undefined, templateName: string): string {
  const taken = new Set(
    all<{ slug: string }>("SELECT slug FROM bio_pages WHERE profile_id = ?", profileId).map((r) => r.slug)
  );
  const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  const want = clean((preferred ?? "").trim() || templateName) || "page";
  if (!taken.has(want)) return want;
  let i = 2;
  while (taken.has(`${want}-${i}`)) i++;
  return `${want}-${i}`;
}