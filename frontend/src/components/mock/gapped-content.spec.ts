import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GappedContent,
  hasGappedDocument,
  sanitizeGappedContent,
} from "./gapped-content";

describe("GappedContent", () => {
  it("defensively strips active and source-only markup", () => {
    const safe = sanitizeGappedContent(
      '<p style="color:red" onclick="bad()">Text<script>alert(1)</script><img src="https://evil.test/a.png"><span data-gap="3"></span></p>',
    );
    expect(safe).toBe('<p>Text<span data-gap="3"></span></p>');
    expect(safe).not.toMatch(/onclick|style|script|img|evil/i);
  });

  it("preserves table structure and replaces a gap with the caller slot", () => {
    const html = renderToStaticMarkup(
      React.createElement(GappedContent, {
        contentHtml: '<table><tbody><tr><td>Room <span data-gap="7"></span></td></tr></tbody></table>',
        questions: [{ id: "q-7", number: 7, prompt: "Room" }],
        renderGap: ({ number, question }) => React.createElement("input", {
          "data-number": number,
          "data-question": question?.id,
          "aria-label": `Answer ${number}`,
        }),
      }),
    );
    expect(html).toContain("<table>");
    expect(html).toContain('data-number="7"');
    expect(html).toContain('data-question="q-7"');
    expect(html).not.toContain("data-gap");
  });

  it("leaves legacy groups on the old rendering path", () => {
    expect(hasGappedDocument(null)).toBe(false);
    expect(hasGappedDocument("   ")).toBe(false);
    expect(hasGappedDocument('<p><span data-gap="1"></span></p>')).toBe(true);
  });
});
