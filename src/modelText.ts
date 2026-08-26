const DSML_TOOL_MARKER = /(?:`{1,3}[ \t]*)?(?:<|＜)?[|｜][ \t]*DSML[ \t]*[|｜][ \t]*(?:function_calls?|tool_calls?)(?:>|＞)?(?:[ \t]*`{1,3})?/giu;
const REASONING_BLOCK = /<\s*(think|thinking|analysis|reasoning)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/giu;
const INTERNAL_DRAFT_OPENER = /^\s*(?:let(?:'s| us)\s+(?:write|craft|compose|prepare|formulate|draft)\b|we need to\s+(?:write|answer|respond)\b|i need to\s+(?:write|answer|respond)\b)/iu;
const EXPLICIT_FINAL_LABEL = /(?:^|\n)\s*(?:final(?: answer| response)?|answer)\s*:\s*/giu;
const SELF_REVIEW = /(?:^|\n)\s*(?:let(?:'s| us)\s+(?:count|check|verify|review)\b|word count\b)[\s\S]{0,500}?(?:(?:excellent|perfect|looks good|good|clean)\s*[.!:]\s*)/giu;

export function sanitizeModelText(value: string): string {
  return value
    .replace(DSML_TOOL_MARKER, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function removeLeakedDraft(value: string): string {
  if (!INTERNAL_DRAFT_OPENER.test(value)) return value;

  const finalLabels = [...value.matchAll(EXPLICIT_FINAL_LABEL)];
  const finalLabel = finalLabels.at(-1);
  if (finalLabel?.index != null) {
    const answer = value.slice(finalLabel.index + finalLabel[0].length).trim();
    if (answer.length >= 20) return answer;
  }

  const reviews = [...value.matchAll(SELF_REVIEW)];
  const review = reviews.at(-1);
  if (review?.index != null) {
    const answer = value.slice(review.index + review[0].length).trim();
    if (answer.length >= 20) return answer;
  }

  return value;
}

function removeRepeatedBlocks(value: string): string {
  const seen = new Set<string>();
  return value
    .split(/\n{2,}/)
    .filter((block) => {
      const key = block.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      if (key.length < 40 || !seen.has(key)) {
        if (key.length >= 40) seen.add(key);
        return true;
      }
      return false;
    })
    .join('\n\n');
}

export function sanitizeVisibleModelText(value: string): string {
  const withoutReasoning = sanitizeModelText(value)
    .replace(REASONING_BLOCK, '')
    .replace(/^\s*(?:analysis|reasoning|thinking)\s*:\s*[\s\S]*?(?:^|\n)\s*(?:final(?: answer| response)?|answer)\s*:\s*/iu, '')
    .trim();

  return removeRepeatedBlocks(removeLeakedDraft(withoutReasoning))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
