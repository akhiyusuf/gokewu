"use client";

import { Icon } from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Sheet";
import type { ConfusableMark } from "@/lib/annotations";

/**
 * Near-twins: two words that look almost identical but do not share a lemma.
 *
 * What this surface may assert is constrained by the data. The corpus supports
 * showing the two forms, their lemmas, their part of speech, and where each
 * occurs — all vetted by the linguists who produced it. It does NOT support
 * generating an explanation of the difference or of why the confusion matters:
 * that is a claim about the meaning of the Quran and needs qualified review.
 * The explanation slot is therefore rendered as a deliberate pending state.
 */
/**
 * Readable forms of the corpus's own POS tags. These restate the dataset's
 * grammatical label — they are not an interpretation of the word's meaning.
 */
const POS_LABEL: Record<string, string> = {
  NOUN: "noun",
  NOUN_PROP: "proper noun",
  NOUN_NUM: "number",
  NOUN_QUANT: "quantifier",
  ADJ: "adjective",
  ADJ_COMP: "comparative adjective",
  ADJ_NUM: "ordinal",
  PV: "perfect verb",
  IV: "imperfect verb",
  CV: "imperative verb",
  PV_PASS: "perfect verb, passive",
  IV_PASS: "imperfect verb, passive",
  PRON: "pronoun",
  DEM_PRON: "demonstrative",
  REL_PRON: "relative pronoun",
  ADV: "adverb",
  VERB: "verb",
  PART: "particle",
  PREP: "preposition",
  CONJ: "conjunction",
};

const posLabel = (pos: string) => POS_LABEL[pos] || pos.toLowerCase().replace(/_/g, " ");

export function ConfusableSheet({
  mark,
  verseKey,
  gloss,
  transliteration,
  onPlayWord,
  onGo,
  onClose,
}: {
  mark: ConfusableMark;
  verseKey: string;
  gloss?: string;
  transliteration?: string;
  onPlayWord: () => void;
  onGo: (verseKey: string) => void;
  onClose: () => void;
}) {
  const twin = mark.with[0];

  return (
    <Sheet
      title="Confusable word"
      onClose={onClose}
      icon={
        <span className="sheet-tile confusable-tile">
          <Icon name="git-compare" size={16} />
        </span>
      }
    >
      <div className="twin-card this-word">
        <span className="tc-body">
          <span className="kicker">This word · {verseKey}</span>
          <span className="glyph">
            <span className="ar">{mark.w}</span>
            {transliteration && <span className="tr">{transliteration}</span>}
          </span>
          <span className="gloss">
            {gloss ? `“${gloss}”` : "—"}
            {mark.pos ? ` — ${posLabel(mark.pos)}` : ""}
          </span>
        </span>
        <button className="twin-play" onClick={onPlayWord} aria-label={`Play ${mark.w}`}>
          <Icon name="volume-2" size={18} />
        </button>
      </div>

      <div className="twin-divider">
        <i />
        <span>LOOKS LIKE</span>
        <i />
      </div>

      {mark.with.map((t, i) => (
        <button
          key={i}
          className="twin-card"
          onClick={() => onGo(t.at)}
          style={{ textAlign: "left", width: "100%" }}
        >
          <span className="tc-body">
            <span className="kicker">
              Twin · {t.at}
              {t.n > 1 ? ` · ${t.n} occurrences` : ""}
            </span>
            <span className="glyph">
              <span className="ar">{t.w}</span>
            </span>
            {/* Lemma and POS come straight from the corpus; no meaning is asserted. */}
            <span className="gloss">
              {t.pos ? posLabel(t.pos) : "different root"} · open {t.at} to read its translation
            </span>
          </span>
          <Icon name="chevron-left" size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
        </button>
      ))}

      {!twin && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No near-twin recorded for this word.</p>
      )}

      <div className="pending-note">
        <Icon name="file-clock" size={22} />
        <b>Study note pending review</b>
        <p>
          Verified translations are linked above. The scholarly note on how to keep these apart is
          reviewed before it appears.
        </p>
      </div>
    </Sheet>
  );
}
