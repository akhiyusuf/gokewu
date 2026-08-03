"use client";

import { Icon } from "@/components/shared/Icon";
import { Sheet } from "@/components/shared/Sheet";
import type { PhraseGroup, PhraseMark } from "@/lib/annotations";

/**
 * Where else this span occurs. The value is anticipatory: the reader learns in
 * advance that a phrase is a known crossover point, instead of discovering it
 * by taking the wrong turn repeatedly.
 */
export function PhraseSheet({
  groups,
  hereKey,
  hereText,
  onGo,
  onClose,
}: {
  groups: { id: string; mark: PhraseMark; group: PhraseGroup }[];
  hereKey: string;
  hereText: string;
  onGo: (
    verseKey: string,
    wordFrom?: number,
    wordTo?: number,
    matchIndex?: number,
    matchTotal?: number,
  ) => void;
  onClose: () => void;
}) {
  const primary = groups[0];
  if (!primary) return null;

  return (
    <Sheet
      title="Recurring phrase"
      onClose={onClose}
      maxHeight="88dvh"
      icon={
        <span className="sheet-tile recurring-tile">
          <Icon name="git-compare" size={16} />
        </span>
      }
    >
      {groups.map(({ id, mark, group }) => {
        const total = group.occ.length;
        /*
         * Diff against this verse's own entry in the dataset, not against the
         * API text: the two sources use different Quranic annotation marks
         * (صِرَٰطٍۢ vs صِرَٰطٍ), so comparing across them makes every
         * occurrence look like a variant.
         */
        const baseline = group.occ.find((o) => o.k === hereKey)?.x ?? "";
        const baseWords = baseline.split(/\s+/).filter(Boolean);
        const renderSnippet = (text: string) => {
          const parts = text.split(/\s+/).filter(Boolean);
          return parts.map((w, i) => (
            <span key={i} className={baseWords[i] && baseWords[i] !== w ? "diff" : undefined}>
              {w}
              {i < parts.length - 1 ? " " : ""}
            </span>
          ));
        };
        return (
          <div key={id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.length > 1 && (
              <span className="label-eyebrow">
                Phrase {groups.indexOf(groups.find((g) => g.id === id)!) + 1} of {groups.length}
              </span>
            )}

            <div className="phrase-hero">
              <div className="ar">{hereText || "—"}</div>
              <div className="sub">
                appears in {total} {total === 1 ? "place" : "places"} · {group.surahs}{" "}
                {group.surahs === 1 ? "surah" : "surahs"}
                {mark.v ? " · this one is a near-variant" : ""}
              </div>
            </div>

            <div className="sheet-list" style={{ gap: 8 }}>
              {group.occ.map((o, i) => {
                const here = o.k === hereKey;
                const variant = !!baseline && !!o.x && o.x !== baseline;
                return (
                  <button
                    key={`${o.k}-${i}`}
                    className={`occ-row${here ? " here" : ""}`}
                    onClick={() => !here && onGo(o.k, o.f, o.t, i + 1, group.occ.length)}
                    disabled={here}
                  >
                    <span className="ref">{o.k}</span>
                    <span className="snippet">…{renderSnippet(o.x)}</span>
                    {here ? (
                      <span className="here-tag">Here</span>
                    ) : variant ? (
                      <span className="variant-chip">Variant</span>
                    ) : (
                      <Icon name="chevron-left" size={16} style={{ color: "var(--text-muted)", flex: "none" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="info-line">
        <Icon name="info" size={13} />
        A common wrong-turn point when reciting from memory.
      </div>
    </Sheet>
  );
}
