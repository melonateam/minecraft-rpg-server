import type { Dialogue, DialogueChoice, DialoguePage } from '../domain/project';
import { emptyChoiceSettings, emptyCondition, emptyServerPage } from '../domain/serverSettings';
import type { ServerCondition, ServerEffects, ServerPageSettings } from '../domain/serverSettings';
import {
  findCharacterByPortrait,
  getCharacter,
  normalizedGender,
  resolvePortraitId,
  type CharacterManifest,
} from './characterRegistry';

type JsonMap = Record<string, unknown>;
type ChoiceWithServer = DialogueChoice & { server?: ReturnType<typeof emptyChoiceSettings> };
type PageWithServer = DialoguePage & { server?: ServerPageSettings };

const map = (value: unknown): JsonMap =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = '') => (value == null ? fallback : String(value));
const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : value == null ? fallback : String(value).toLowerCase() === 'true';

function cleanRecord(value: JsonMap): JsonMap {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => {
      if (child === undefined || child === null || child === '') return false;
      if (Array.isArray(child)) return child.length > 0;
      if (typeof child === 'object') return Object.keys(child as JsonMap).length > 0;
      return true;
    }),
  );
}

function conditionToServer(condition: ServerCondition): JsonMap {
  if (condition.mode === 'none') return { type: 'NONE' };
  const result: JsonMap = {
    type: condition.mode.toUpperCase(),
    variable: condition.variable,
    operator: condition.operator.replace('-', '_').toUpperCase(),
    value: condition.value,
    'extra-variables': condition.extraVariables,
    'variable-logic': condition.variableLogic.toUpperCase(),
    'item-spec': condition.itemSpec,
  };
  const replacement = condition.replacementLines.join('\n').replace(/\n+$/g, '');
  if (replacement) result.replacement = replacement;
  return cleanRecord(result);
}

function conditionFromServer(raw: unknown): ServerCondition {
  const data = map(raw);
  const condition = emptyCondition();
  const type = text(data.type, 'NONE').toLowerCase();
  condition.mode = ['variable', 'item', 'both', 'any'].includes(type)
    ? (type as ServerCondition['mode'])
    : 'none';
  condition.variable = text(data.variable);
  condition.value = text(data.value);
  const operator = text(data.operator, 'EQ').toLowerCase().replace('_', '-');
  condition.operator = [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'is-set',
    'is-unset',
  ].includes(operator)
    ? (operator as ServerCondition['operator'])
    : 'eq';
  condition.extraVariables = text(data['extra-variables']);
  const logic = text(data['variable-logic'], 'AND').toLowerCase();
  condition.variableLogic = ['and', 'or', 'xor', 'not'].includes(logic)
    ? (logic as ServerCondition['variableLogic'])
    : 'and';
  condition.itemSpec = text(data['item-spec']);
  const replacement = text(data.replacement);
  condition.replacementLines = [
    replacement.split('\n')[0] ?? '',
    replacement.split('\n')[1] ?? '',
    replacement.split('\n')[2] ?? '',
    replacement.split('\n')[3] ?? '',
  ];
  return condition;
}

function effectsToServer(effects: ServerEffects): JsonMap {
  return cleanRecord({
    items: effects.giveItems,
    'take-items': effects.takeItems,
    'variables-set': effects.variablesSet,
    'variables-delete': effects.variablesDelete,
    'chat-input-variable': effects.chatInputVariable,
    sounds: effects.sounds,
    message: effects.message,
    'message-color': effects.messageColor || '#FFFFFF',
    'return-mode': effects.returnTarget ? 'TARGET' : 'NONE',
    'return-target': effects.returnTarget,
    command: effects.serverCommand,
    'command-target': effects.commandTarget.toUpperCase(),
  });
}

function effectsFromServer(raw: unknown): ServerEffects {
  const data = map(raw);
  const result = emptyServerPage().effects;
  result.giveItems = text(data.items || data.item);
  result.takeItems = text(data['take-items'] || data['take-item']);
  result.variablesSet = text(data['variables-set']);
  if (!result.variablesSet && data.variable) {
    const action = text(data['variable-action'], 'SET').toLowerCase();
    const operator = action === 'add' ? '+=' : action === 'subtract' ? '-=' : '=';
    result.variablesSet = `${text(data.variable)}${operator}${text(data.value)}`;
  }
  result.variablesDelete = text(data['variables-delete']);
  if (!result.variablesDelete && text(data['variable-action']).toUpperCase() === 'DELETE')
    result.variablesDelete = text(data.variable);
  result.chatInputVariable = text(data['chat-input-variable']);
  result.sounds = text(data.sounds);
  if (!result.sounds && data.sound) {
    result.sounds = `${text(data.sound)}:${text(data['sound-pitch'], '1')}:${text(data['sound-volume'], '1')}:1`;
  }
  result.message = text(data.message);
  result.messageColor = text(data['message-color'], '#FFFFFF');
  result.returnTarget = text(data['return-target']);
  result.serverCommand = text(data.command);
  const target = text(data['command-target'], 'PLAYER').toLowerCase();
  result.commandTarget = ['player', 'all', 'nearest'].includes(target)
    ? (target as ServerEffects['commandTarget'])
    : 'player';
  return result;
}

function pageText(lines: DialoguePage['lines']) {
  const copy = [...lines];
  while (copy.length > 1 && copy.at(-1) === '') copy.pop();
  return copy.join('\n');
}

export function exportMinecraftDialogue(dialogue: Dialogue, manifest: CharacterManifest): JsonMap {
  const output: JsonMap = structuredClone(dialogue.server?.raw ?? {});
  const pageIndex = new Map(dialogue.pages.map((page, index) => [page.id, index + 1]));
  output.title = dialogue.name;
  output['message-pages'] = dialogue.pages.map((page) => pageText(page.lines));
  output.speaker = dialogue.pages[0]?.speaker ?? '';

  const speakers: JsonMap = {};
  const portraits: JsonMap = {};
  const expressions: JsonMap = {};
  const visible: JsonMap = {};
  const choices: JsonMap = {};
  const conditions: JsonMap = {};
  const effects: JsonMap = {};
  const flows: JsonMap = {};
  const operations: JsonMap = {};

  dialogue.pages.forEach((rawPage, index) => {
    const page = rawPage as PageWithServer;
    const server = page.server ?? emptyServerPage();
    speakers[index] = page.speaker;
    visible[index] = page.appearance.visible;

    const character = getCharacter(manifest, page.appearance.characterId);
    if (character) {
      const gender = normalizedGender(character, page.appearance.gender);
      portraits[index] = resolvePortraitId(character, gender);
      expressions[index] = page.appearance.expression ?? 'NEUTRAL';
    }

    if (page.choices.length) {
      const choiceData: JsonMap = { 'choice-count': page.choices.length };
      page.choices.forEach((rawChoice, choiceIndex) => {
        const choice = rawChoice as ChoiceWithServer;
        const slot = choiceIndex + 1;
        choiceData[`choice-${slot}`] = choice.label;
        choiceData[`target-page-${slot}`] = choice.targetPageId ? pageIndex.get(choice.targetPageId) ?? 0 : 0;
        choiceData[`end-${slot}`] = choice.endAfterTarget ?? false;
        if (choice.speakerOverride) choiceData[`speaker-${slot}`] = choice.speakerOverride;
        const condition = choice.server?.condition;
        if (condition && condition.mode !== 'none')
          choiceData[`condition-${slot}`] = conditionToServer(condition);
      });
      choices[index] = choiceData;
    }

    if (server.displayCondition.mode !== 'none') conditions[index] = conditionToServer(server.displayCondition);
    const pageEffects = effectsToServer(server.effects);
    if (Object.keys(pageEffects).length) effects[index] = pageEffects;

    const flow: JsonMap = {
      'next-page': server.flow.nextPageId ? pageIndex.get(server.flow.nextPageId) ?? 0 : 0,
      terminal: server.flow.ending,
      'jump-target': server.flow.conditionalTargetPageId
        ? pageIndex.get(server.flow.conditionalTargetPageId) ?? 0
        : 0,
      'jump-timing': server.flow.conditionalTiming.toUpperCase(),
    };
    if (server.flow.condition.mode !== 'none') flow.condition = conditionToServer(server.flow.condition);
    flows[index] = cleanRecord(flow);
    if (server.operationOnly) operations[index] = true;
  });

  output['page-speakers'] = speakers;
  output['page-portraits'] = portraits;
  output['page-expressions'] = expressions;
  output['page-show-portraits'] = visible;
  output['page-choices'] = choices;
  output['page-conditions'] = conditions;
  output['page-effects'] = effects;
  output['page-flow'] = flows;
  output['page-operation-only'] = operations;
  return output;
}

export function importMinecraftDialogue(
  remoteName: string,
  raw: JsonMap,
  revision: string,
  ownerUuid: string,
  manifest: CharacterManifest,
): Dialogue {
  const pageTexts = list(raw['message-pages']).map((value) => text(value));
  if (!pageTexts.length) pageTexts.push(text(raw.message));
  const pageIds = pageTexts.map(() => crypto.randomUUID());
  const speakerMap = map(raw['page-speakers']);
  const portraitMap = map(raw['page-portraits']);
  const expressionMap = map(raw['page-expressions']);
  const visibleMap = map(raw['page-show-portraits']);
  const choiceMap = map(raw['page-choices']);
  const conditionMap = map(raw['page-conditions']);
  const effectMap = map(raw['page-effects']);
  const flowMap = map(raw['page-flow']);
  const operationMap = map(raw['page-operation-only']);
  const defaultSpeaker = text(raw.speaker);
  let inheritedPortrait = text(raw.portrait);
  let inheritedExpression = text(raw.expression, 'NEUTRAL');

  const pages: DialoguePage[] = pageTexts.map((message, index) => {
    inheritedPortrait = text(portraitMap[index], inheritedPortrait);
    inheritedExpression = text(expressionMap[index], inheritedExpression);
    const found = findCharacterByPortrait(manifest, inheritedPortrait);
    const split = message.split('\n');
    const server = emptyServerPage();
    server.displayCondition = conditionFromServer(conditionMap[index]);
    server.effects = effectsFromServer(effectMap[index]);
    server.operationOnly = bool(operationMap[index]);

    const serverFlow = map(flowMap[index]);
    server.flow.ending = bool(serverFlow.terminal);
    server.flow.conditionalTiming =
      text(serverFlow['jump-timing'], 'AFTER').toUpperCase() === 'BEFORE' ? 'before' : 'after';
    server.flow.condition = conditionFromServer(serverFlow.condition);

    const pageChoices = map(choiceMap[index]);
    const choiceCount = Math.min(8, number(pageChoices['choice-count']));
    const choicesForPage: DialogueChoice[] = Array.from({ length: choiceCount }, (_, choiceIndex) => {
      const slot = choiceIndex + 1;
      const targetNumber = number(pageChoices[`target-page-${slot}`]);
      const choice: ChoiceWithServer = {
        id: crypto.randomUUID(),
        label: text(pageChoices[`choice-${slot}`]),
        targetPageId: targetNumber > 0 ? pageIds[targetNumber - 1] : undefined,
        endAfterTarget: bool(pageChoices[`end-${slot}`]),
        speakerOverride: text(pageChoices[`speaker-${slot}`]) || undefined,
        server: { condition: conditionFromServer(pageChoices[`condition-${slot}`]) },
      };
      return choice;
    });

    const page: PageWithServer = {
      id: pageIds[index],
      editorLabel: `Page ${index + 1}`,
      speaker: text(speakerMap[index], defaultSpeaker),
      lines: [split[0] ?? '', split[1] ?? '', split[2] ?? '', split[3] ?? ''],
      appearance: {
        visible: bool(visibleMap[index], true),
        inheritPrevious: portraitMap[index] == null && index > 0,
        characterId: found?.character.id,
        gender: found?.gender === 'FEMALE' ? 'female' : found?.gender === 'MALE' ? 'male' : undefined,
        expression: inheritedExpression || 'NEUTRAL',
      },
      choices: choicesForPage,
      flow: { ending: server.flow.ending },
      effects: [],
      operationOnly: server.operationOnly,
      server,
    };
    return page;
  });

  pages.forEach((rawPage, index) => {
    const page = rawPage as PageWithServer;
    const serverFlow = map(flowMap[index]);
    const next = number(serverFlow['next-page']);
    const jump = number(serverFlow['jump-target']);
    if (next > 0) page.server!.flow.nextPageId = pageIds[next - 1];
    if (jump > 0) page.server!.flow.conditionalTargetPageId = pageIds[jump - 1];
  });

  return {
    id: crypto.randomUUID(),
    name: text(raw.title, remoteName),
    pages,
    startPageId: pages[0]?.id ?? '',
    server: {
      ownerUuid,
      remoteName,
      revision,
      raw: structuredClone(raw),
      lastSyncedAt: new Date().toISOString(),
    },
  };
}
