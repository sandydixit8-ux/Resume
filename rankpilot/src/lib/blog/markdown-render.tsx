import type { ReactNode } from "react";
import type { Block, Inline } from "./markdown";
import { safeUrl } from "./safe-url";

/**
 * Renders a Markdown AST as React children.
 *
 * This is the whole reason the parser exists: React escapes every string it
 * renders, so no output here can introduce markup. The one value that could --
 * an href or image src -- is filtered through safeUrl() and degrades to inert
 * text when refused, so an unsafe URL is visible to a human reviewing the post
 * instead of silently disappearing.
 */

const HEADING_CLASS: Record<number, string> = {
  1: "text-3xl font-bold tracking-tight text-ink-900 mt-10 mb-4",
  2: "text-2xl font-bold tracking-tight text-ink-900 mt-9 mb-3",
  3: "text-xl font-semibold text-ink-900 mt-7 mb-3",
  4: "text-lg font-semibold text-ink-900 mt-6 mb-2",
  5: "text-base font-semibold text-ink-900 mt-5 mb-2",
  6: "text-sm font-semibold uppercase tracking-wide text-ink-500 mt-4 mb-2",
};

/**
 * Keys are derived from tree position (`${prefix}.${index}`) rather than a
 * module-level counter. A shared counter is not just untidy: React Server
 * Components render concurrently, so two interleaved renderMarkdown() calls
 * would hand out overlapping keys. Position is stable and collision-free here
 * because a block or inline node has exactly one parent.
 */
function renderInlines(nodes: Inline[], prefix: string): ReactNode[] {
  return nodes.map((node, index): ReactNode => {
    const key = `${prefix}.${index}`;
    switch (node.kind) {
      case "text":
        // A bare string, not a <span>. React escapes it identically and emits no
        // wrapper, which keeps the markup readable and avoids a layer of
        // elements around every word. Strings in an array need no key.
        return node.value;

      case "code":
        return (
          <code
            key={key}
            className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[0.9em] text-ink-800"
          >
            {node.value}
          </code>
        );

      case "strong":
        return (
          <strong key={key} className="font-semibold text-ink-900">
            {renderInlines(node.children, `${key}s`)}
          </strong>
        );

      case "em":
        return (
          <em key={key} className="italic">
            {renderInlines(node.children, `${key}e`)}
          </em>
        );

      case "strike":
        return (
          <s key={key} className="text-ink-400 line-through">
            {renderInlines(node.children, `${key}k`)}
          </s>
        );

      case "link": {
        const decision = safeUrl(node.href);
        if (!decision.ok) {
          // Rendered as plain text. A refused link is a content bug the author
          // should see, not a silent hole in the post.
          return (
            <span key={key} className="text-ink-400 underline decoration-dotted">
              {renderInlines(node.children, `${key}r`)}
            </span>
          );
        }
        const external = /^https?:/i.test(decision.href);
        return (
          <a
            key={key}
            href={decision.href}
            title={node.title}
            className="text-brand-700 underline underline-offset-2 hover:text-brand-800"
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer nofollow" }
              : {})}
          >
            {renderInlines(node.children, `${key}a`)}
          </a>
        );
      }

      case "image": {
        const decision = safeUrl(node.src);
        if (!decision.ok) {
          return (
            <span key={key} className="text-ink-400 italic">
              {node.alt || "image"}
            </span>
          );
        }
        // A plain <img>, not next/image. next/image would need the width and
        // height of every remote image at build time, and blog posts are
        // arbitrary Markdown whose image URLs are known only at render time.
        return (
          <img
            key={key}
            src={decision.href}
            alt={node.alt}
            title={node.title}
            className="my-6 w-full rounded-lg border border-ink-200"
          />
        );
      }
    }
  });
}

function renderBlocks(blocks: Block[], prefix: string): ReactNode[] {
  return blocks.map((block, index): ReactNode => {
    const key = `${prefix}.${index}`;

    switch (block.kind) {
      case "heading": {
        const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        return (
          <Tag key={key} className={HEADING_CLASS[block.level]}>
            {renderInlines(block.children, `${key}h`)}
          </Tag>
        );
      }

      case "paragraph":
        return (
          <p key={key} className="my-4 leading-7 text-ink-700">
            {renderInlines(block.children, `${key}p`)}
          </p>
        );

      case "code":
        return (
          <pre
            key={key}
            className="my-6 overflow-x-auto rounded-lg bg-ink-900 p-4 text-sm text-ink-50"
          >
            <code className="font-mono">{block.value}</code>
          </pre>
        );

      case "hr":
        return <hr key={key} className="my-8 border-ink-200" />;

      case "blockquote":
        return (
          <blockquote
            key={key}
            className="my-6 border-l-4 border-brand-300 bg-brand-50/40 py-2 pl-4 pr-3 text-ink-700"
          >
            {renderBlocks(block.children, `${key}bq`)}
          </blockquote>
        );

      case "list": {
        const items = block.items.map((item, index) => (
          <li key={`${key}-${index}`} className="my-1.5 pl-1 leading-7 text-ink-700">
            {/* A single-paragraph item is rendered without the <p>, which would
                otherwise add vertical margins inside every bullet and break the
                spacing of a tight list. Multi-block items keep their <p>s. */}
            {item.length === 1 && item[0].kind === "paragraph"
              ? renderInlines(item[0].children, `${key}i${index}`)
              : renderBlocks(item, `${key}i${index}`)}
          </li>
        ));
        return block.ordered ? (
          <ol
            key={key}
            start={block.start}
            className="my-4 list-decimal space-y-1 pl-6 marker:font-semibold marker:text-ink-400"
          >
            {items}
          </ol>
        ) : (
          <ul key={key} className="my-4 list-disc space-y-1 pl-6 marker:text-ink-400">
            {items}
          </ul>
        );
      }
    }
  });
}

export function renderMarkdown(blocks: Block[]): ReactNode[] {
  return renderBlocks(blocks, "r");
}
