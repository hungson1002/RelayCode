import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'src/webview/chatViewController.ts');
const source = await readFile(sourcePath, 'utf8');
const opening = "export const CHAT_VIEW_CONTROLLER = String.raw`";
const openingIndex = source.indexOf(opening);
let body;
if (openingIndex >= 0 && source.endsWith('`;\n')) {
  body = source.slice(openingIndex + opening.length, -3);
} else {
  const previous = [...source.matchAll(/from '\.\/controller\/([A-Za-z]+)'/g)].map((match) => match[1]);
  if (!previous.length) throw new Error('No existing controller fragments were found.');
  const fragments = await Promise.all(previous.map((name) => readFile(resolve(root, `src/webview/controller/${name}.ts`), 'utf8')));
  body = fragments.map((fragment) => {
    const start = fragment.indexOf('String.raw`');
    if (start < 0 || !fragment.endsWith('`;\n')) throw new Error('Unexpected controller fragment structure.');
    return fragment.slice(start + 'String.raw`'.length, -3);
  }).join('');
}
const boundaries = [
  ['core', 0],
  ['streaming', body.indexOf('function flushAssistantText()')],
  ['models', body.indexOf('function updateComposerPlaceholder()')],
  ['markdown', body.indexOf('function formatCompact(value)')],
  ['activity', body.indexOf("const activityCopy = (vi, en) =>")],
  ['panels', body.indexOf('function renderTelemetry(records = [])')],
  ['transcript', body.indexOf('function showSetup(show)')],
  ['composer', body.indexOf('function renderGoal(goal)')],
  ['events', body.indexOf("$('modeTrigger').addEventListener")],
  ['hostLifecycle', body.indexOf("window.addEventListener('message', ({ data }) =>")],
  ['hostModels', body.indexOf("  } else if (data.type === 'modelRuntimeFailure')")],
  ['hostInteraction', body.indexOf("  } else if (data.type === 'approval')")],
  ['hostChanges', body.indexOf("  } else if (data.type === 'changesState')")],
  ['hostTurns', body.indexOf("  } else if (data.type === 'turnStart')")]
];
if (boundaries.some(([, index]) => index < 0)) throw new Error('A controller split marker was not found.');
if (boundaries.some(([, index], position) => position > 0 && index <= boundaries[position - 1][1])) throw new Error('Controller split markers are out of order.');

const names = [];
const controllerDirectory = resolve(root, 'src/webview/controller');
for (const entry of await readdir(controllerDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.ts')) await unlink(resolve(controllerDirectory, entry.name));
}
for (let index = 0; index < boundaries.length; index++) {
  const [name, start] = boundaries[index];
  const end = boundaries[index + 1]?.[1] ?? body.length;
  const content = body.slice(start, end);
  const constant = `CHAT_CONTROLLER_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
  const imports = name === 'core'
    ? "import { BRAND_ICONS, MODEL_BRAND_RULES } from '../../brandIcons';\nimport { UI_ICONS } from '../../uiIcons';\n\n"
    : '';
  await writeFile(
    resolve(controllerDirectory, `${name}.ts`),
    `${imports}export const ${constant} = String.raw\`${content}\`;\n`,
    'utf8'
  );
  names.push({ name, constant });
}

const imports = names.map(({ name, constant }) => `import { ${constant} } from './controller/${name}';`).join('\n');
const values = names.map(({ constant }) => `  ${constant}`).join(',\n');
await writeFile(sourcePath, `${imports}\n\nexport const CHAT_VIEW_CONTROLLER = [\n${values}\n].join('');\n`, 'utf8');
