import type { ChatMode, RouterModel } from './types';

function modelText(model: RouterModel): string {
  return `${model.id} ${model.name}`.toLowerCase();
}

function scoreModel(mode: ChatMode, model: RouterModel): number {
  const text = modelText(model);
  const capabilities = model.capabilities;
  let score = 0;
  if (mode !== 'chat' && capabilities?.tools !== false) score += 30;
  if ((mode === 'agent' || mode === 'plan') && capabilities?.reasoning) score += 28;
  if (mode === 'chat') {
    if (/\b(?:mini|small|fast|flash|haiku|nano|instant|turbo)\b/.test(text)) score += 24;
    if (/\b(?:reasoning|thinking|opus|large|pro|max)\b/.test(text)) score -= 8;
  } else {
    if (/\b(?:agent|coder|coding|reasoning|thinking|opus|sonnet|pro|max|gpt-5|o[134]|r1)\b/.test(text)) score += 18;
  }
  if (capabilities?.vision) score += mode === 'chat' ? 2 : 4;
  return score;
}

function isEligible(mode: ChatMode, model: RouterModel): boolean {
  if (model.kind?.toLowerCase() === 'image') return false;
  return mode === 'chat' || model.capabilities?.tools !== false;
}

/**
 * Keeps an explicitly selected model first, then orders configured and
 * provider-advertised fallbacks for the current mode.
 */
export function rankedModelsForMode(
  mode: ChatMode,
  preferredModel: string,
  models: RouterModel[],
  configuredFallbacks: string[] = []
): string[] {
  const known = new Map(models.map((model) => [model.id, model]));
  const eligible = (id: string): boolean => {
    const model = known.get(id);
    return !model || isEligible(mode, model);
  };
  const explicit = [preferredModel.trim(), ...configuredFallbacks.map((item) => item.trim())]
    .filter((item, index, list) => item && list.indexOf(item) === index && eligible(item));
  const automatic = models
    .filter((model) => isEligible(mode, model) && !explicit.includes(model.id))
    .sort((left, right) => scoreModel(mode, right) - scoreModel(mode, left) || left.name.localeCompare(right.name))
    .map((model) => model.id);
  return [...explicit, ...automatic];
}

export function chooseModelForMode(
  mode: ChatMode,
  preferredModel: string,
  models: RouterModel[],
  configuredFallbacks: string[] = []
): string | undefined {
  return rankedModelsForMode(mode, preferredModel, models, configuredFallbacks)[0];
}
