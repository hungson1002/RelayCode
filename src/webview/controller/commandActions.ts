export const CHAT_CONTROLLER_COMMAND_ACTIONS = String.raw`function openComposerModelPicker() {
  closeDropdowns($('modelMenu'));
  favoriteModelsAtMenuOpen = [...favoriteModels];
  $('modelSearch').value = '';
  $('modelMenu').classList.remove('hidden');
  $('modelPicker').classList.add('open');
  $('modelTrigger').setAttribute('aria-expanded', 'true');
  renderModelMenu();
  scrollSelectedModelIntoView();
  requestAnimationFrame(() => $('modelSearch').focus());
}

function clearComposerCommandInput(trigger) {
  if (trigger) replaceComposerTrigger(trigger);
  else $('prompt').value = '';
  composerCommand = null;
  renderComposerTokens();
  resizePrompt();
  updateSendState();
}

function runImmediateComposerCommand(key, trigger = null) {
  const command = String(key || '').trim().toLowerCase();
  if (command === '/goal') {
    clearComposerCommandInput(trigger);
    composerGoalMode = true;
    renderComposerTokens();
    $('prompt').focus();
    return true;
  }
  if (command === '/skills') {
    if (trigger) replaceComposerTrigger(trigger, '$');
    else $('prompt').value = '$';
    composerCommand = null;
    composerMenuIndex = -1;
    renderComposerTokens();
    renderComposerMenu();
    $('prompt').focus();
    return true;
  }
  if (command === '/model' || command === '/models') {
    clearComposerCommandInput(trigger);
    openComposerModelPicker();
    return true;
  }
  if (command === '/mode') {
    clearComposerCommandInput(trigger);
    $('modeTrigger').click();
    return true;
  }
  if (command === '/permissions') {
    clearComposerCommandInput(trigger);
    $('permissionMode').click();
    return true;
  }
  if (command === '/check-models') {
    clearComposerCommandInput(trigger);
    $('checkModels').click();
    return true;
  }
  if (command === '/history') {
    clearComposerCommandInput(trigger);
    $('historyToggle').click();
    return true;
  }
  if (command === '/usage') {
    clearComposerCommandInput(trigger);
    $('metricsToggle').click();
    return true;
  }
  if (command === '/agent' || command === '/chat') {
    clearComposerCommandInput(trigger);
    setMode(command.slice(1));
    $('prompt').focus();
    return true;
  }
  if (command === '/plan') {
    clearComposerCommandInput(trigger);
    setMode('plan');
    $('prompt').focus();
    return true;
  }
  if (command === '/settings') {
    clearComposerCommandInput(trigger);
    openFloatingSurface('configPanel');
    return true;
  }
  if (command === '/mcp') {
    clearComposerCommandInput(trigger);
    openFloatingSurface('mcpPanel');
    vscode.postMessage({ type: 'getMcpServers' });
    return true;
  }
  if (command === '/diagnostics') {
    clearComposerCommandInput(trigger);
    runConnectionDiagnostics();
    return true;
  }
  if (command === '/new' || command === '/clear') {
    clearComposerCommandInput(trigger);
    vscode.postMessage({ type: 'newThread' });
    return true;
  }
  return false;
}
`;
