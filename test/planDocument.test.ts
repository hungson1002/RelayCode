import { describe, expect, it } from 'vitest';
import { inlineIcon, planDocumentTitle, renderPlanDocumentHtml, renderPlanMarkdown } from '../src/webview/planDocument';

describe('Implementation Plan document', () => {
  it('renders structured Markdown without allowing raw HTML or scripts', () => {
    const output = renderPlanMarkdown([
      '# Safe plan',
      '',
      '## Proposed changes',
      '- Update **src/app.ts**',
      '- Read [documentation](https://example.com/docs)',
      '<script>bad()</script>'
    ].join('\n'));

    expect(output).toContain('<h2>Safe plan</h2>');
    expect(output).toContain('<h3>Proposed changes</h3>');
    expect(output).toContain('<strong>src/app.ts</strong>');
    expect(output).toContain('data-external="https://example.com/docs"');
    expect(output).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(output).not.toContain('<script>bad()');
  });

  it('creates a reviewable editor surface with explicit Proceed and save actions', () => {
    const html = renderPlanDocumentHtml({ cspSource: 'vscode-webview://plan-test' }, {
      title: 'Upgrade the application',
      prompt: 'Add authentication and tests',
      plan: '# Upgrade the application\n\n## Files\n\n- `src/app.ts`',
      createdAt: 1_785_000_000_000,
      language: 'en'
    });

    expect(html).toContain("script-src 'nonce-");
    expect(html).toContain('Review before implementation');
    expect(html).toContain('id="save"');
    expect(html).toContain('id="revise"');
    expect(html).toContain('class="primary proceed"');
    expect(html).toContain("vscode.postMessage({type:'proceed'})");
    expect(html).not.toContain('<h2>Upgrade the application</h2>');
  });

  it('escapes a closing script tag inside the plan data payload', () => {
    const html = renderPlanDocumentHtml({ cspSource: 'vscode-webview://plan-test' }, {
      title: 'Safe plan',
      prompt: 'Check escaping',
      plan: '</script><script>bad()</script>',
      createdAt: Date.now(),
      language: 'en'
    });
    expect(html).toContain('\\u003c/script>');
    expect(html).not.toContain('const plan="</script>');
  });

  it('uses the first plan heading as the editor title', () => {
    expect(planDocumentTitle('# Delivery plan\n\nDetails', 'Fallback prompt')).toBe('Delivery plan');
    expect(planDocumentTitle('No heading', 'Fallback prompt')).toBe('Fallback prompt');
  });

  it('renders directory trees as compact Codex-style fenced code', () => {
    const output = renderPlanMarkdown([
      '## Project structure',
      '```text',
      'movie-web/',
      '',
      '├── public/                  # Static assets',
      '└── src/',
      '    ├── app/                 # Next.js routes',
      '    └── index.ts             # Entry point',
      '```'
    ].join('\n'));

    expect(output).toContain('class="file-tree-code"');
    expect(output).toContain('class="tree-code-toolbar"');
    expect(output).toContain('class="tree-copy"');
    expect(output).toContain('movie-web/');
    expect(output).toContain('<span class="tree-connector">├── </span><span class="tree-node">public/</span>');
    expect(output).toContain('<span class="tree-comment">  # Static assets</span>');
    expect(output).toContain('<pre><code>');
    expect(output).not.toContain('movie-web/\n\n├──');
  });

  it('keeps ordinary fenced code as a code block', () => {
    const output = renderPlanMarkdown('```ts\nconst ready = true;\n```');
    expect(output).toContain('<pre data-language="ts"><code>');
    expect(output).toContain('const ready = true;');
    expect(output).not.toContain('class="file-tree"');
  });

  it('rebuilds flat full paths into a nested directory tree', () => {
    const output = renderPlanMarkdown([
      '```text',
      '├── movie-web/ # Project root',
      '├── movie-web/public/ # Static assets',
      '├── movie-web/src/ # Source',
      '├── movie-web/src/app/ # Routes',
      '└── movie-web/src/app/layout.tsx # Root layout',
      '```'
    ].join('\n'));

    expect(output).toContain('<span class="tree-node">movie-web/</span><span class="tree-comment">  # Project root</span>');
    expect(output).toContain('<span class="tree-connector">├── </span><span class="tree-node">public/</span>');
    expect(output).toContain('<span class="tree-connector">└── </span><span class="tree-node">src/</span>');
    expect(output).toContain('<span class="tree-connector">    └── </span><span class="tree-node">app/</span>');
    expect(output).toContain('<span class="tree-connector">        └── </span><span class="tree-node">layout.tsx</span>');
    expect(output).not.toContain('movie-web/src/app/layout.tsx');
  });

  it('supports both production raw SVG imports and test data URLs', () => {
    const raw = '<svg viewBox="0 0 16 16"><path d="M1 1"/></svg>';
    expect(inlineIcon(raw)).toBe(raw);
    expect(inlineIcon(`data:image/svg+xml,${encodeURIComponent(raw)}`)).toBe(raw);
  });
});
