import type { DialogueChoice, DialoguePage, RPGProject } from '../domain/project';
import { emptyChoiceSettings, emptyServerPage } from '../domain/serverSettings';

const characterIds: Record<string, string> = {
  merchant: 'INNKEEPER',
  villager: 'VILLAGER',
  warrior: 'WARRIOR',
  mage: 'MAGE',
  guard: 'SENTINEL',
  king: 'KING',
};

const expressions: Record<string, string> = {
  기본: 'NEUTRAL',
  무표정: 'NEUTRAL',
  기쁨: 'HAPPY',
  슬픔: 'SAD',
  화남: 'ANGRY',
  놀람: 'SURPRISED',
  당황: 'SURPRISED',
  부끄러움: 'EMBARRASSED',
};

type ExtendedPage = DialoguePage & { server?: ReturnType<typeof emptyServerPage> };
type ExtendedChoice = DialogueChoice & { server?: ReturnType<typeof emptyChoiceSettings> };

export function migrateProject(project: RPGProject): RPGProject {
  const next = structuredClone(project);
  for (const dialogue of next.dialogues) {
    for (const rawPage of dialogue.pages) {
      const page = rawPage as ExtendedPage;
      page.lines = [page.lines?.[0] ?? '', page.lines?.[1] ?? '', page.lines?.[2] ?? '', page.lines?.[3] ?? ''];
      page.appearance.characterId =
        characterIds[page.appearance.characterId ?? ''] ?? page.appearance.characterId?.toUpperCase();
      page.appearance.expression =
        expressions[page.appearance.expression ?? ''] ?? page.appearance.expression?.toUpperCase() ?? 'NEUTRAL';
      page.server ??= emptyServerPage();
      if (page.operationOnly) page.server.operationOnly = true;
      if (page.flow?.ending) page.server.flow.ending = true;
      for (const rawChoice of page.choices) {
        const choice = rawChoice as ExtendedChoice;
        choice.server ??= emptyChoiceSettings();
      }
    }
  }
  next.pendingServerDeletes ??= [];
  next.schemaVersion = 2;
  next.characters = [];
  return next;
}
