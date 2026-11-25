import { describe, expect, it } from 'vitest';
import { compatibleReasoningContent, createThinkTagSplitter } from '../src/routerClient';

describe('Thinking / Reasoning extraction', () => {
  it('extracts provider reasoning_content, reasoning and structured thinking blocks', () => {
    expect(compatibleReasoningContent({ reasoning_content: 'Step 1' })).toBe('Step 1');
    expect(compatibleReasoningContent({ reasoning: 'Check imports' })).toBe('Check imports');
    expect(compatibleReasoningContent({
      content: [
        { type: 'thinking', thinking: 'Inspecting AST' },
        { type: 'text', text: 'Visible answer' }
      ]
    })).toBe('Inspecting AST');
  });

  it('splits streamed <think>...</think> blocks cleanly across arbitrary chunk boundaries', () => {
    let visible = '';
    let thinking = '';
    const splitter = createThinkTagSplitter(
      (chunk) => { visible += chunk; },
      (chunk) => { thinking += chunk; }
    );
    for (const part of ['<thi', 'nk>First ', 'thought', '</th', 'ink>Hello ', 'world!']) {
      splitter.push(part);
    }
    splitter.flush();

    expect(thinking).toBe('First thought');
    expect(visible).toBe('Hello world!');
  });
});
