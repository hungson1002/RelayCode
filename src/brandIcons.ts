import {
  siFigma,
  siGithub,
  siGoogle,
  siLinear,
  siModelcontextprotocol,
  siNotion,
  siSentry
} from 'simple-icons';
import nineRouterSvg from './assets/brands/9router.svg';
import cockpitPng from './assets/brands/cockpit.png';
import anthropicSvg from '@lobehub/icons-static-svg/icons/anthropic.svg';
import antigravitySvg from '@lobehub/icons-static-svg/icons/antigravity-color.svg';
import azureSvg from '@lobehub/icons-static-svg/icons/azure-color.svg';
import baichuanSvg from '@lobehub/icons-static-svg/icons/baichuan-color.svg';
import bedrockSvg from '@lobehub/icons-static-svg/icons/bedrock-color.svg';
import bytedanceSvg from '@lobehub/icons-static-svg/icons/bytedance-color.svg';
import cerebrasSvg from '@lobehub/icons-static-svg/icons/cerebras-color.svg';
import chatGlmSvg from '@lobehub/icons-static-svg/icons/chatglm-color.svg';
import claudeSvg from '@lobehub/icons-static-svg/icons/claude-color.svg';
import cohereSvg from '@lobehub/icons-static-svg/icons/cohere-color.svg';
import deepseekSvg from '@lobehub/icons-static-svg/icons/deepseek-color.svg';
import doubaoSvg from '@lobehub/icons-static-svg/icons/doubao-color.svg';
import figmaSvg from '@lobehub/icons-static-svg/icons/figma-color.svg';
import geminiSvg from '@lobehub/icons-static-svg/icons/gemini-color.svg';
import grokSvg from '@lobehub/icons-static-svg/icons/grok.svg';
import groqSvg from '@lobehub/icons-static-svg/icons/groq.svg';
import huggingFaceSvg from '@lobehub/icons-static-svg/icons/huggingface-color.svg';
import kiroSvg from '@lobehub/icons-static-svg/icons/kiro-color.svg';
import kimiSvg from '@lobehub/icons-static-svg/icons/kimi-color.svg';
import lmStudioSvg from '@lobehub/icons-static-svg/icons/lmstudio.svg';
import metaSvg from '@lobehub/icons-static-svg/icons/meta-color.svg';
import minimaxSvg from '@lobehub/icons-static-svg/icons/minimax-color.svg';
import mistralSvg from '@lobehub/icons-static-svg/icons/mistral-color.svg';
import nvidiaSvg from '@lobehub/icons-static-svg/icons/nvidia-color.svg';
import ollamaSvg from '@lobehub/icons-static-svg/icons/ollama.svg';
import openAiSvg from '@lobehub/icons-static-svg/icons/openai.svg';
import openRouterSvg from '@lobehub/icons-static-svg/icons/openrouter-color.svg';
import perplexitySvg from '@lobehub/icons-static-svg/icons/perplexity-color.svg';
import qwenSvg from '@lobehub/icons-static-svg/icons/qwen-color.svg';
import siliconCloudSvg from '@lobehub/icons-static-svg/icons/siliconcloud-color.svg';
import stabilitySvg from '@lobehub/icons-static-svg/icons/stability-color.svg';
import stepfunSvg from '@lobehub/icons-static-svg/icons/stepfun-color.svg';
import togetherSvg from '@lobehub/icons-static-svg/icons/together-color.svg';
import voyageSvg from '@lobehub/icons-static-svg/icons/voyage-color.svg';
import zeroOneSvg from '@lobehub/icons-static-svg/icons/zeroone-color.svg';
import zhipuSvg from '@lobehub/icons-static-svg/icons/zhipu-color.svg';

function simpleIcon(icon: { title: string; path: string; hex: string }, color = `#${icon.hex}`): string {
  return `<svg role="img" aria-label="${icon.title}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><title>${icon.title}</title><path d="${icon.path}"/></svg>`;
}

export const BRAND_ICONS: Record<string, string> = {
  '9router': nineRouterSvg,
  antigravity: antigravitySvg,
  anthropic: anthropicSvg,
  azure: azureSvg,
  baichuan: baichuanSvg,
  bedrock: bedrockSvg,
  bytedance: bytedanceSvg,
  cerebras: cerebrasSvg,
  chatglm: chatGlmSvg,
  claude: claudeSvg,
  cockpit: `<img src="${cockpitPng}" alt="" aria-hidden="true">`,
  cohere: cohereSvg,
  deepseek: deepseekSvg,
  doubao: doubaoSvg,
  figma: figmaSvg,
  gemini: geminiSvg,
  github: simpleIcon(siGithub, 'currentColor'),
  google: simpleIcon(siGoogle),
  grok: grokSvg,
  groq: groqSvg,
  huggingface: huggingFaceSvg,
  kiro: kiroSvg,
  kimi: kimiSvg,
  linear: simpleIcon(siLinear),
  'lm-studio': lmStudioSvg,
  mcp: simpleIcon(siModelcontextprotocol, 'currentColor'),
  meta: metaSvg,
  minimax: minimaxSvg,
  mistral: mistralSvg,
  nvidia: nvidiaSvg,
  notion: simpleIcon(siNotion, 'currentColor'),
  ollama: ollamaSvg,
  openai: openAiSvg,
  'openai-compatible': openRouterSvg,
  openrouter: openRouterSvg,
  perplexity: perplexitySvg,
  qwen: qwenSvg,
  sentry: simpleIcon(siSentry, '#AB6DFF'),
  siliconcloud: siliconCloudSvg,
  stability: stabilitySvg,
  stepfun: stepfunSvg,
  together: togetherSvg,
  voyage: voyageSvg,
  zeroone: zeroOneSvg,
  zhipu: zhipuSvg
};

export const MODEL_BRAND_RULES: ReadonlyArray<readonly [string, string]> = [
  ['gemini', 'gemini'],
  ['claude', 'claude'],
  ['anthropic', 'anthropic'],
  ['deepseek', 'deepseek'],
  ['mistral|codestral|mixtral', 'mistral'],
  ['ollama', 'ollama'],
  ['qwen|alibaba', 'qwen'],
  ['grok|xai|x-ai', 'grok'],
  ['kiro|^kr/', 'kiro'],
  ['kimi|moonshot', 'kimi'],
  ['chatglm', 'chatglm'],
  ['zhipu|glm[-_/ ]?\\d', 'zhipu'],
  ['minimax', 'minimax'],
  ['groq', 'groq'],
  ['cerebras', 'cerebras'],
  ['nvidia|nemotron', 'nvidia'],
  ['together', 'together'],
  ['huggingface|hugging-face|^hf/', 'huggingface'],
  ['doubao', 'doubao'],
  ['bytedance|byte-dance', 'bytedance'],
  ['siliconcloud|silicon-cloud', 'siliconcloud'],
  ['stepfun|step[-_/ ]?\\d', 'stepfun'],
  ['baichuan', 'baichuan'],
  ['zeroone|01-ai|yi-large|yi-lightning', 'zeroone'],
  ['stability|stable-diffusion|sdxl', 'stability'],
  ['voyage', 'voyage'],
  ['lm studio|lm-studio', 'lm-studio'],
  ['llama|meta', 'meta'],
  ['openrouter|openai-compatible', 'openrouter'],
  ['perplexity', 'perplexity'],
  ['cohere|command-r', 'cohere'],
  ['bedrock|amazon', 'bedrock'],
  ['azure', 'azure'],
  ['github|copilot', 'github'],
  ['antigravity|^ag/', 'antigravity'],
  ['vertex|google', 'google'],
  ['gpt|openai|codex|(^|[/_-])o[134](?:[/_.-]|$)', 'openai'],
  ['9router', '9router'],
  ['cockpit', 'cockpit']
];

export function brandKeyFor(value: string, provider = ''): string {
  const id = value.toLowerCase();
  for (const [pattern, key] of MODEL_BRAND_RULES) {
    if (new RegExp(pattern, 'i').test(id)) return key;
  }
  return BRAND_ICONS[provider] ? provider : 'mcp';
}

export function brandMarkup(key: string, label: string, className = 'brand-symbol'): string {
  const safeLabel = label.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  return `<span class="${className}" title="${safeLabel}" aria-label="${safeLabel}">${BRAND_ICONS[key] ?? BRAND_ICONS.mcp}</span>`;
}
