const DSML_TOOL_MARKER = /(?:`{1,3}[ \t]*)?(?:<|＜)?[|｜][ \t]*DSML[ \t]*[|｜][ \t]*(?:function_calls?|tool_calls?)(?:>|＞)?(?:[ \t]*`{1,3})?/giu;

export function sanitizeModelText(value: string): string {
  return value
    .replace(DSML_TOOL_MARKER, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}
