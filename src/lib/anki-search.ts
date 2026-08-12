/** Parse Anki-style search: deck:"X" tag:foo is:suspended flag:1 */

export type ParsedSearch = {
  text: string;
  deck: string;
  tag: string;
  flag: number | null;
  isSuspended: boolean | null;
  isNew: boolean | null;
  isLearning: boolean | null;
  isReview: boolean | null;
};

export function parseAnkiSearch(raw: string): ParsedSearch {
  const out: ParsedSearch = {
    text: "",
    deck: "",
    tag: "",
    flag: null,
    isSuspended: null,
    isNew: null,
    isLearning: null,
    isReview: null,
  };

  let rest = raw.trim();
  const deckM = rest.match(/deck:"([^"]+)"/i);
  if (deckM) {
    out.deck = deckM[1];
    rest = rest.replace(deckM[0], " ");
  }
  const tagM = rest.match(/tag:(\S+)/i);
  if (tagM) {
    out.tag = tagM[1];
    rest = rest.replace(tagM[0], " ");
  }
  const flagM = rest.match(/flag:(\d)/i);
  if (flagM) {
    out.flag = parseInt(flagM[1], 10);
    rest = rest.replace(flagM[0], " ");
  }
  if (/\bis:suspended\b/i.test(rest)) {
    out.isSuspended = true;
    rest = rest.replace(/\bis:suspended\b/i, " ");
  }
  if (/\bis:new\b/i.test(rest)) {
    out.isNew = true;
    rest = rest.replace(/\bis:new\b/i, " ");
  }
  if (/\bis:learn\b/i.test(rest)) {
    out.isLearning = true;
    rest = rest.replace(/\bis:learn\b/i, " ");
  }
  if (/\bis:review\b/i.test(rest)) {
    out.isReview = true;
    rest = rest.replace(/\bis:review\b/i, " ");
  }

  out.text = rest.replace(/\s+/g, " ").trim();
  return out;
}
