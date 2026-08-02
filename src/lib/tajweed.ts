/**
 * The Quran Foundation API returns tajweed markup as custom
 * `<tajweed class=rule>` tags embedded in the Uthmani text. This is parsed in
 * an inert document (`document.implementation.createHTMLDocument`) and only
 * text nodes plus recognised `<tajweed>` wrappers are kept — everything else
 * is unwrapped. This is deliberate XSS hardening against the raw API string;
 * do not replace it with regex or `dangerouslySetInnerHTML` of the raw
 * source. See feature-spec.md §2.
 *
 * Client-only: relies on `document`. Callers must guard for SSR (all call
 * sites in this app are inside "use client" components that only render
 * after mount).
 */

/**
 * The API is inconsistent about which tag carries a rule: verse-level markup
 * uses `<tajweed class=…>` while word-level markup uses `<rule class=…>`.
 * Accepting only the former is why word tajweed looked "unreliable" and the
 * app fell back to splitting the verse-level string on every passage.
 */
const TAJWEED_TAGS = new Set(["tajweed", "rule"]);

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

let tajRoot: HTMLDivElement | null = null;
function getRoot(): HTMLDivElement {
  if (!tajRoot) {
    tajRoot = document.implementation.createHTMLDocument("taj").createElement("div");
  }
  return tajRoot;
}

/** Convert quran.com tajweed markup into safe `<i class="tj tj-rule">` spans. */
export function tajToSpans(src: string | null | undefined): string {
  try {
    const root = getRoot();
    root.innerHTML = String(src ?? "");
    const walk = (node: Node): string => {
      let out = "";
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 3) {
          out += esc(c.nodeValue);
        } else if (c.nodeType === 1) {
          const el = c as Element;
          const cls = (el.getAttribute?.("class") || "").trim().split(/\s+/)[0] || "";
          if (TAJWEED_TAGS.has(el.tagName.toLowerCase()) && /^[\w-]+$/.test(cls)) {
            out += `<i class="tj tj-${cls}">${walk(el)}</i>`;
          } else {
            out += walk(el);
          }
        }
      }
      return out;
    };
    const html = walk(root);
    root.innerHTML = "";
    return html;
  } catch {
    return esc(src);
  }
}

/**
 * Fallback for missing word-level tajweed: splits VERSE-level tajweed markup
 * into one HTML chunk per word. Rules that span the space between two words
 * (idgham/iqlab/ikhfa on tanween) get their tag closed at the boundary and
 * reopened on the next word so joining is never broken. Ayah-number wrappers
 * (`<span class=end>`) are dropped; standalone ornaments (۞ rub el hizb, ۩
 * sajdah) merge into a neighbouring word so counts line up. Returns null on
 * any mismatch — caller falls back to plain text, never a misaligned
 * colouring.
 */
export function splitTajweedVerse(src: string | null | undefined, wordCount: number): string[] | null {
  if (!src || !wordCount) return null;
  try {
    const root = getRoot();
    root.innerHTML = String(src);
    const out: string[] = [];
    const stack: string[] = [];
    let cur = "";
    let hasText = false;
    const openAll = () => stack.map((cl) => `<i class="tj tj-${cl}">`).join("");
    const closeAll = () => "</i>".repeat(stack.length);
    const pushWord = () => {
      if (hasText) out.push(cur);
      cur = "";
      hasText = false;
    };
    const boundary = () => {
      cur += closeAll();
      pushWord();
      cur = openAll();
    };
    const emitText = (txt: string) => {
      const parts = String(txt).split(/\s+/);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) boundary();
        if (parts[i]) {
          cur += esc(parts[i]);
          hasText = true;
        }
      }
    };
    const walk = (node: Node) => {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 3) {
          emitText(c.nodeValue || "");
        } else if (c.nodeType === 1) {
          const el = c as Element;
          const cls = (el.getAttribute?.("class") || "").trim().split(/\s+/)[0] || "";
          if (TAJWEED_TAGS.has(el.tagName.toLowerCase()) && /^[\w-]+$/.test(cls)) {
            stack.push(cls);
            cur += `<i class="tj tj-${cls}">`;
            walk(el);
            stack.pop();
            cur += "</i>";
          } else if (cls === "end") {
            boundary();
          } else {
            walk(el);
          }
        }
      }
    };
    walk(root);
    pushWord();
    root.innerHTML = "";

    // merge standalone ornament tokens into a neighbouring word
    for (let i = out.length - 1; i >= 0 && out.length > wordCount; i--) {
      const bare = out[i]!.replace(/<[^>]+>/g, "");
      if (/^[۞۩]+$/.test(bare)) {
        if (i + 1 < out.length) {
          out[i + 1] = out[i] + " " + out[i + 1];
        } else if (i > 0) {
          out[i - 1] = out[i - 1] + " " + out[i];
        } else {
          continue;
        }
        out.splice(i, 1);
      }
    }
    return out.length === wordCount ? out : null;
  } catch {
    return null;
  }
}
