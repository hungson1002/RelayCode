import { CHAT_CONTROLLER_CORE } from './controller/core';
import { CHAT_CONTROLLER_STREAMING } from './controller/streaming';
import { CHAT_CONTROLLER_MODELS } from './controller/models';
import { CHAT_CONTROLLER_MARKDOWN } from './controller/markdown';
import { CHAT_CONTROLLER_ACTIVITY } from './controller/activity';
import { CHAT_CONTROLLER_PANELS } from './controller/panels';
import { CHAT_CONTROLLER_TRANSCRIPT } from './controller/transcript';
import { CHAT_CONTROLLER_COMPOSER } from './controller/composer';
import { CHAT_CONTROLLER_EVENTS } from './controller/events';
import { CHAT_CONTROLLER_HOST_LIFECYCLE } from './controller/hostLifecycle';
import { CHAT_CONTROLLER_HOST_MODELS } from './controller/hostModels';
import { CHAT_CONTROLLER_HOST_INTERACTION } from './controller/hostInteraction';
import { CHAT_CONTROLLER_HOST_CHANGES } from './controller/hostChanges';
import { CHAT_CONTROLLER_HOST_TURNS } from './controller/hostTurns';

export const CHAT_VIEW_CONTROLLER = [
  CHAT_CONTROLLER_CORE,
  CHAT_CONTROLLER_STREAMING,
  CHAT_CONTROLLER_MODELS,
  CHAT_CONTROLLER_MARKDOWN,
  CHAT_CONTROLLER_ACTIVITY,
  CHAT_CONTROLLER_PANELS,
  CHAT_CONTROLLER_TRANSCRIPT,
  CHAT_CONTROLLER_COMPOSER,
  CHAT_CONTROLLER_EVENTS,
  CHAT_CONTROLLER_HOST_LIFECYCLE,
  CHAT_CONTROLLER_HOST_MODELS,
  CHAT_CONTROLLER_HOST_INTERACTION,
  CHAT_CONTROLLER_HOST_CHANGES,
  CHAT_CONTROLLER_HOST_TURNS
].join('');
