import type { ServerChoiceSettings, ServerPageSettings } from './serverSettings';

export type ProjectId = string;
export type DialogueId = string;
export type PageId = string;

export interface RPGProject {
  id: ProjectId;
  name: string;
  dialogues: Dialogue[];
  characters: CharacterDefinition[];
  variables: VariableDefinition[];
  items: ItemDefinition[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface Dialogue {
  id: DialogueId;
  name: string;
  pages: DialoguePage[];
  startPageId: PageId;
  editor?: {
    nodePositions?: Record<string, { x: number; y: number }>;
  };
  server?: {
    ownerUuid?: string;
    remoteName?: string;
    revision?: string;
    raw?: Record<string, unknown>;
    lastSyncedAt?: string;
  };
}

export interface DialoguePage {
  id: PageId;
  editorLabel?: string;
  speaker: string;
  lines: [string, string, string, string];
  appearance: PageAppearance;
  choices: DialogueChoice[];
  flow: PageFlow;
  effects: PageEffect[];
  operationOnly?: boolean;
  server?: ServerPageSettings;
}

export interface PageAppearance {
  visible: boolean;
  inheritPrevious: boolean;
  characterId?: string;
  gender?: 'male' | 'female';
  expression?: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
  targetPageId?: PageId;
  endAfterTarget?: boolean;
  speakerOverride?: string;
}

export interface PageFlow {
  nextPageId?: PageId;
  ending: boolean;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  emoji: string;
  expressions: string[];
}

export interface VariableDefinition {
  id: string;
  name: string;
  type: 'number' | 'boolean' | 'string';
  initialValue: number | boolean | string;
}

export interface ItemDefinition {
  id: string;
  minecraftId: string;
  displayName: string;
  amount: number;
}

export type PageEffect =
  | { id: string; type: 'set-variable'; variableId: string; value: string | number | boolean }
  | { id: string; type: 'give-item'; itemId: string; amount: number };
