import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Dialogue, DialogueChoice, DialoguePage } from '../../domain/project';
import { emptyServerPage } from '../../domain/serverSettings';
import {
  loadCharacterManifest,
  type CharacterManifest,
} from '../../services/characterRegistry';
import {
  capturePlayerSession,
  PlayerSessionApiClient,
  RevisionConflictError,
  type PlayerSessionConnection,
  type ServerDialogueDocument,
} from '../../services/playerSessionApi';
import {
  exportMinecraftDialogue,
  importMinecraftDialogue,
} from '../../services/minecraftCompatibility';
import { createDialogue, createPage } from '../../services/projectFactory';
import {
  validateProject,
  type ValidationIssue,
} from '../../services/projectValidator';
import { useEditorStore } from '../../store/editorStore';
import { useProjectStore } from '../../store/projectStore';
import { TestMode } from '../preview/TestMode';
import { DialogueSidebar } from './DialogueSidebar';
import {
  EditorInspector,
  type InspectorSection,
} from './EditorInspector';
import { EffectsInspector } from './EffectsInspector';
import { PlayerConnectionModal } from './PlayerConnectionModal';
import { ScriptWorkspace } from './ScriptWorkspace';
import {
  StudioToolbar,
  type ServerUiStatus,
} from './StudioToolbar';
import { ValidationPanel } from './ValidationPanel';

type RightPanel =
  | { kind: 'inspector'; section: InspectorSection }
  | { kind: 'validation' }
  | undefined;

const BUILTIN_VARIABLES = [
  'player_name',
  'player_world',
  'player_x',
  'player_y',
  'player_z',
  'player_health',
  'held_item_name',
  'held_item_type',
  'held_item_amount',
];

const normalizedName = (value: string) => value.trim().toLocaleLowerCase();
const serverNameKey = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/[^\p{L}\p{N}_-]/gu, '_').toLocaleLowerCase() : '';
};

function forEachChoice(choices: DialogueChoice[], visit: (choice: DialogueChoice) => void) {
  for (const choice of choices) {
    visit(choice);
    for (const response of choice.responsePages ?? []) forEachChoice(response.choices, visit);
  }
}

function renewBranchIds(choices: DialogueChoice[]) {
  forEachChoice(choices, (choice) => {
    choice.id = crypto.randomUUID();
    for (const response of choice.responsePages ?? []) response.id = crypto.randomUUID();
  });
}

function sectionForIssue(section: ValidationIssue['section']): InspectorSection | undefined {
  if (section === 'character') return 'character';
  if (section === 'choices') return 'choices';
  if (section === 'condition') return 'condition';
  if (section === 'effects') return 'effects';
  if (section === 'flow') return 'flow';
  return undefined;
}

function collectVariableNames(dialogue: Dialogue, projectVariables: string[]) {
  const names = new Set([...BUILTIN_VARIABLES, ...projectVariables]);
  const placeholder = /\{\{([A-Za-z0-9._-]+)}}/g;
  for (const page of dialogue.pages) {
    for (const line of page.lines) {
      for (const match of line.matchAll(placeholder)) names.add(match[1]);
    }
    const settings = page.server;
    if (!settings) continue;
    if (settings.displayCondition.variable) names.add(settings.displayCondition.variable);
    if (settings.flow.condition.variable) names.add(settings.flow.condition.variable);
    if (settings.effects.chatInputVariable) names.add(settings.effects.chatInputVariable);
    for (const assignment of settings.effects.variablesSet.split(',')) {
      const match = assignment.trim().match(/^([A-Za-z0-9._-]+)\s*(?:\+=|-=|\*=|\/=|=)/);
      if (match) names.add(match[1]);
    }
  }
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function DialogueStudioV2() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const project = useProjectStore((state) => state.projects.find((candidate) => candidate.id === projectId));
  const mutateProject = useProjectStore((state) => state.mutateProject);
  const applyHistorySnapshot = useProjectStore((state) => state.applyHistorySnapshot);
  const saveNow = useProjectStore((state) => state.saveNow);
  const saveStatus = useProjectStore((state) => state.saveStatus);

  const activeDialogueId = useEditorStore((state) => state.activeDialogueId);
  const activePageId = useEditorStore((state) => state.activePageId);
  const selectDialogue = useEditorStore((state) => state.selectDialogue);
  const selectPage = useEditorStore((state) => state.selectPage);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);
  const takeUndo = useEditorStore((state) => state.takeUndo);
  const takeRedo = useEditorStore((state) => state.takeRedo);
  const resetHistory = useEditorStore((state) => state.resetHistory);

  const [manifest, setManifest] = useState<CharacterManifest>();
  const [manifestError, setManifestError] = useState<string>();
  const [rightPanel, setRightPanel] = useState<RightPanel>();
  const [testMode, setTestMode] = useState(false);
  const [serverModal, setServerModal] = useState(false);
  const [connection, setConnection] = useState<PlayerSessionConnection>();
  const [serverStatus, setServerStatus] = useState<ServerUiStatus>('disconnected');
  const [serverMessage, setServerMessage] = useState('게임에서 /rpgmaker web 링크로 연결하세요.');

  useEffect(() => {
    loadCharacterManifest()
      .then(setManifest)
      .catch((error) => setManifestError(error instanceof Error ? error.message : '캐릭터 리소스를 읽지 못했습니다.'));
  }, []);

  useEffect(() => {
    const sessionId = capturePlayerSession();
    if (!sessionId) {
      setServerStatus('disconnected');
      return;
    }
    let cancelled = false;
    setServerStatus('connecting');
    setServerMessage('서버 링크의 플레이어 정보를 확인하는 중입니다.');
    void new PlayerSessionApiClient(sessionId)
      .connect()
      .then((next) => {
        if (cancelled) return;
        setConnection(next);
        setServerStatus('connected');
        setServerMessage(`${next.playerName} 계정으로 자동 연결됨`);
      })
      .catch((error) => {
        if (cancelled) return;
        setConnection(undefined);
        setServerStatus('error');
        setServerMessage(error instanceof Error ? error.message : '플레이어 세션 연결에 실패했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!project) return;
    const active = project.dialogues.find((candidate) => candidate.id === activeDialogueId) ?? project.dialogues[0];
    if (active && active.id !== activeDialogueId) selectDialogue(active.id, active.pages[0]?.id);
  }, [project, activeDialogueId, selectDialogue]);

  useEffect(() => {
    resetHistory();
    setRightPanel(undefined);
    setTestMode(false);
  }, [projectId, resetHistory]);

  const dialogue = project?.dialogues.find((candidate) => candidate.id === activeDialogueId) ?? project?.dialogues[0];
  const page = dialogue?.pages.find((candidate) => candidate.id === activePageId) ?? dialogue?.pages[0];

  const issues = useMemo(
    () => (project && manifest ? validateProject(project, manifest) : []),
    [project, manifest],
  );
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const variableNames = useMemo(
    () =>
      dialogue && project
        ? collectVariableNames(dialogue, project.variables.map((variable) => variable.name))
        : BUILTIN_VARIABLES,
    [dialogue, project],
  );

  const changePage = (mutator: (draft: DialoguePage) => void) => {
    if (!project || !dialogue || !page) return;
    mutateProject(project.id, (draftProject) => {
      const draftDialogue = draftProject.dialogues.find((candidate) => candidate.id === dialogue.id);
      const draftPage = draftDialogue?.pages.find((candidate) => candidate.id === page.id);
      if (draftPage) {
        draftPage.server ??= emptyServerPage();
        mutator(draftPage);
      }
    });
  };

  const undo = () => {
    if (!project) return;
    const snapshot = takeUndo(project);
    if (snapshot) applyHistorySnapshot(snapshot);
  };

  const redo = () => {
    if (!project) return;
    const snapshot = takeRedo(project);
    if (snapshot) applyHistorySnapshot(snapshot);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!project) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveNow(project.id);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        setTestMode(true);
        setRightPanel(undefined);
      } else if (event.key === 'Escape') {
        if (testMode) setTestMode(false);
        else {
          setRightPanel(undefined);
          setServerModal(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [project, saveNow, testMode, past.length, future.length]);

  useEffect(() => {
    if (!dialogue || !connection) return;
    if (!dialogue.server?.remoteName) {
      setServerStatus('connected');
      setServerMessage(`${connection.playerName} 계정으로 연결됨 · 아직 서버에 반영되지 않은 대화`);
      return;
    }
    let cancelled = false;
    setServerStatus('connecting');
    const api = new PlayerSessionApiClient(connection.sessionId);
    void api
      .getDialogue(connection.ownerUuid, dialogue.server.remoteName)
      .then((remote) => {
        if (cancelled) return;
        if (dialogue.server?.revision && remote.revision !== dialogue.server.revision) {
          setServerStatus('stale');
          setServerMessage(`${connection.playerName} · 서버 데이터가 더 최신임 (${remote.revision.slice(0, 8)})`);
        } else {
          setServerStatus('connected');
          setServerMessage(`${connection.playerName} · revision ${remote.revision.slice(0, 8)}`);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setServerStatus('error');
        setServerMessage(error instanceof Error ? error.message : '서버 상태 확인 실패');
      });
    return () => {
      cancelled = true;
    };
  }, [dialogue?.id, dialogue?.server?.revision, dialogue?.server?.remoteName, connection]);

  if (!project) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] text-[#9aa3af]">
        작업공간을 찾을 수 없습니다.
      </main>
    );
  }

  if (!dialogue || !page) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] p-8 text-center text-[#9aa3af]">
        <div>
          <div>현재 작업공간에 대화가 없습니다.</div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 rounded-lg bg-[#252b35] px-4 py-2 text-sm text-white"
          >
            대화 목록으로
          </button>
        </div>
      </main>
    );
  }

  if (manifestError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] p-8 text-center text-red-300">
        <div>
          <div className="font-semibold">Character Manifest 로드 실패</div>
          <div className="mt-2 text-sm text-[#9aa3af]">{manifestError}</div>
          <div className="mt-2 text-xs text-[#6e7784]">npm run sync:assets 후 다시 실행하세요.</div>
        </div>
      </main>
    );
  }

  if (!manifest) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] text-[#8e98a5]">
        Resource Pack 캐릭터를 불러오는 중...
      </main>
    );
  }

  const createNewDialogue = () => {
    const entered = window.prompt('새 대화 이름', `대화 ${project.dialogues.length + 1}`);
    if (entered === null) return;
    const name = entered.trim();
    if (!name) {
      window.alert('대화 이름을 입력해 주세요.');
      return;
    }
    if (project.dialogues.some((candidate) => normalizedName(candidate.name) === normalizedName(name))) {
      window.alert(`'${name}' 이름의 대화가 이미 있습니다. 생성하지 않았습니다.`);
      return;
    }
    if (project.dialogues.some((candidate) => serverNameKey(candidate.server?.remoteName || candidate.name) === serverNameKey(name))) {
      window.alert(`'${name}'은 서버에서 기존 대화와 같은 저장 이름이 됩니다. 다른 이름을 사용해 주세요.`);
      return;
    }
    const next = createDialogue(name);
    mutateProject(project.id, (draft) => void draft.dialogues.push(next));
    selectDialogue(next.id, next.pages[0]?.id);
    setRightPanel(undefined);
  };

  const deleteCurrentDialogue = () => {
    if (!window.confirm(`'${dialogue.name}' 대화를 삭제할까요?\n서버에 연결된 대화라면 다음 '서버에 반영' 때 서버에서도 삭제됩니다.`)) return;
    const fallback = project.dialogues.find((candidate) => candidate.id !== dialogue.id);
    mutateProject(project.id, (draft) => {
      const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
      if (target?.server?.ownerUuid && target.server.remoteName) {
        draft.pendingServerDeletes ??= [];
        const duplicate = draft.pendingServerDeletes.some(
          (entry) => entry.ownerUuid === target.server!.ownerUuid && entry.remoteName === target.server!.remoteName,
        );
        if (!duplicate) {
          draft.pendingServerDeletes.push({
            ownerUuid: target.server.ownerUuid,
            remoteName: target.server.remoteName,
            revision: target.server.revision,
          });
        }
      }
      draft.dialogues = draft.dialogues.filter((candidate) => candidate.id !== dialogue.id);
    });
    setRightPanel(undefined);
    if (fallback) selectDialogue(fallback.id, fallback.pages[0]?.id);
    else navigate('/');
  };

  const createNewPage = () => {
    if (dialogue.pages.length >= 30) return;
    const next = createPage(`Page ${dialogue.pages.length + 1}`);
    const previous = dialogue.pages.at(-1);
    if (previous) {
      next.speaker = previous.speaker;
      next.appearance = {
        ...structuredClone(previous.appearance),
        inheritPrevious: false,
      };
    }
    mutateProject(project.id, (draft) => {
      const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
      target?.pages.push(next);
    });
    selectPage(next.id);
  };

  const duplicatePage = (pageId: string) => {
    if (dialogue.pages.length >= 30) return;
    const source = dialogue.pages.find((candidate) => candidate.id === pageId);
    if (!source) return;
    const duplicate = structuredClone(source);
    duplicate.id = crypto.randomUUID();
    duplicate.editorLabel = `${source.editorLabel || `Page ${dialogue.pages.indexOf(source) + 1}`} 복사본`;
    renewBranchIds(duplicate.choices);
    mutateProject(project.id, (draft) => {
      const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
      const sourceIndex = target?.pages.findIndex((candidate) => candidate.id === pageId) ?? -1;
      if (target && sourceIndex >= 0) target.pages.splice(sourceIndex + 1, 0, duplicate);
    });
    selectPage(duplicate.id);
  };

  const deletePage = (pageId: string) => {
    if (dialogue.pages.length <= 1) return;
    const targetPage = dialogue.pages.find((candidate) => candidate.id === pageId);
    if (!targetPage) return;

    const references: string[] = [];
    dialogue.pages.forEach((candidate, index) => {
      forEachChoice(candidate.choices, (choice) => {
        if (choice.targetPageId === pageId)
          references.push(`Page ${index + 1} / 선택지 "${choice.label || '이름 없음'}"`);
      });
      if (candidate.server?.flow.nextPageId === pageId) references.push(`Page ${index + 1} / 다음 페이지`);
      if (candidate.server?.flow.conditionalTargetPageId === pageId) references.push(`Page ${index + 1} / 조건부 Jump`);
    });

    const message = [
      `${targetPage.editorLabel || '이 페이지'}를 삭제할까요?`,
      references.length ? `\n현재 참조:\n• ${references.join('\n• ')}\n\n삭제하면 해당 연결이 제거됩니다.` : '',
    ].join('');
    if (!window.confirm(message)) return;

    mutateProject(project.id, (draft) => {
      const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
      if (!target) return;
      target.pages = target.pages.filter((candidate) => candidate.id !== pageId);
      target.pages.forEach((candidate) => {
        forEachChoice(candidate.choices, (choice) => {
          if (choice.targetPageId === pageId) choice.targetPageId = undefined;
        });
        if (candidate.server?.flow.nextPageId === pageId) candidate.server.flow.nextPageId = undefined;
        if (candidate.server?.flow.conditionalTargetPageId === pageId)
          candidate.server.flow.conditionalTargetPageId = undefined;
      });
      if (target.startPageId === pageId) target.startPageId = target.pages[0]?.id ?? '';
    });
    const fallback = dialogue.pages.find((candidate) => candidate.id !== pageId);
    if (fallback) selectPage(fallback.id);
    setRightPanel(undefined);
  };

  const navigateIssue = (
    targetDialogue: Dialogue,
    targetPageId: string | undefined,
    section: ValidationIssue['section'],
  ) => {
    const resolvedPage = targetPageId ?? targetDialogue.pages[0]?.id;
    selectDialogue(targetDialogue.id, resolvedPage);
    if (resolvedPage) selectPage(resolvedPage);
    const inspectorSection = sectionForIssue(section);
    setRightPanel(inspectorSection ? { kind: 'inspector', section: inspectorSection } : undefined);
  };

  const importRemote = async (document: ServerDialogueDocument) => {
    if (!connection) return;
    const imported = importMinecraftDialogue(
      document.name,
      document.dialogue,
      document.revision,
      connection.ownerUuid,
      manifest,
    );
    const existing = project.dialogues.find(
      (candidate) =>
        (candidate.server?.ownerUuid === connection.ownerUuid &&
          serverNameKey(candidate.server?.remoteName ?? '') === serverNameKey(document.name)) ||
        normalizedName(candidate.name) === normalizedName(imported.name) ||
        serverNameKey(candidate.name) === serverNameKey(document.name),
    );
    if (existing) imported.id = existing.id;

    mutateProject(project.id, (draft) => {
      const existingIndex = draft.dialogues.findIndex(
        (candidate) =>
          (candidate.server?.ownerUuid === connection.ownerUuid &&
            serverNameKey(candidate.server?.remoteName ?? '') === serverNameKey(document.name)) ||
          normalizedName(candidate.name) === normalizedName(imported.name) ||
          serverNameKey(candidate.name) === serverNameKey(document.name),
      );
      if (existingIndex >= 0) draft.dialogues[existingIndex] = imported;
      else draft.dialogues.push(imported);
      draft.pendingServerDeletes = (draft.pendingServerDeletes ?? []).filter(
        (entry) => !(entry.ownerUuid === connection.ownerUuid && entry.remoteName === document.name),
      );
    });
    selectDialogue(imported.id, imported.pages[0]?.id);
    setServerStatus('connected');
    setServerMessage(`${connection.playerName} · 서버에서 ${document.name}을 불러왔습니다.`);
  };

  const pullFromServer = async () => {
    if (!connection) {
      setServerModal(true);
      setServerMessage('게임에서 /rpgmaker web 링크로 먼저 연결하세요.');
      return;
    }
    setServerStatus('syncing');
    setServerMessage(`${connection.playerName} · 서버 대화 목록을 동기화하는 중`);
    try {
      const api = new PlayerSessionApiClient(connection.sessionId);
      const [summaries, serverItems] = await Promise.all([
        api.listDialogues(connection.ownerUuid),
        api.listItems(connection.ownerUuid),
      ]);
      const documents = await Promise.all(
        summaries.map((summary) => api.getDialogue(connection.ownerUuid, summary.name)),
      );
      const imported = documents.map((document) =>
        importMinecraftDialogue(document.name, document.dialogue, document.revision, connection.ownerUuid, manifest),
      );
      const remoteNames = new Set(summaries.map((summary) => serverNameKey(summary.name)));

      imported.forEach((next) => {
        const existing = project.dialogues.find(
          (candidate) =>
            (candidate.server?.ownerUuid === connection.ownerUuid &&
              serverNameKey(candidate.server?.remoteName ?? '') === serverNameKey(next.server?.remoteName ?? '')) ||
            normalizedName(candidate.name) === normalizedName(next.name) ||
            serverNameKey(candidate.name) === serverNameKey(next.server?.remoteName ?? ''),
        );
        if (existing) next.id = existing.id;
      });

      mutateProject(project.id, (draft) => {
        draft.items = [
          ...draft.items.filter((item) => !item.minecraftId.startsWith(`@${connection.ownerUuid}/`)),
          ...serverItems.map((item) => ({
            id: item.reference,
            minecraftId: item.reference,
            displayName: item.material ? `${item.title} · ${item.material}` : item.title,
            amount: 1,
          })),
        ];
        draft.dialogues = draft.dialogues.filter((candidate) => {
          if (candidate.server?.ownerUuid !== connection.ownerUuid || !candidate.server.remoteName) return true;
          return remoteNames.has(serverNameKey(candidate.server.remoteName));
        });
        for (const next of imported) {
          const index = draft.dialogues.findIndex(
            (candidate) =>
              (candidate.server?.ownerUuid === connection.ownerUuid &&
                serverNameKey(candidate.server?.remoteName ?? '') === serverNameKey(next.server?.remoteName ?? '')) ||
              normalizedName(candidate.name) === normalizedName(next.name) ||
              serverNameKey(candidate.name) === serverNameKey(next.server?.remoteName ?? ''),
          );
          if (index >= 0) draft.dialogues[index] = next;
          else draft.dialogues.push(next);
        }
        draft.pendingServerDeletes = (draft.pendingServerDeletes ?? []).filter(
          (entry) => entry.ownerUuid !== connection.ownerUuid,
        );
      });

      const preferred = imported.find((candidate) => candidate.id === dialogue.id) ?? imported[0];
      if (preferred) selectDialogue(preferred.id, preferred.pages[0]?.id);
      setServerStatus('connected');
      setServerMessage(`${connection.playerName} · 서버 대화 ${summaries.length}개와 저장 아이템 ${serverItems.length}개를 동기화했습니다.`);
    } catch (error) {
      setServerStatus('error');
      setServerMessage(error instanceof Error ? error.message : '서버 대화를 불러오지 못했습니다.');
    }
  };

  const applyToServer = async () => {
    if (errorCount > 0) {
      setRightPanel({ kind: 'validation' });
      setServerMessage('오류를 수정한 뒤 서버에 반영할 수 있습니다.');
      return;
    }
    if (!connection) {
      setServerModal(true);
      setServerMessage('게임에서 /rpgmaker web 링크로 먼저 연결하세요.');
      return;
    }

    const duplicateNames = project.dialogues
      .map((candidate) => serverNameKey(candidate.server?.remoteName || candidate.name))
      .filter((name, index, all) => all.indexOf(name) !== index);
    if (duplicateNames.length) {
      setServerStatus('error');
      setServerMessage('같은 이름의 대화가 두 개 이상 있어 서버에 반영할 수 없습니다. 중복 이름을 먼저 정리하세요.');
      return;
    }

    setServerStatus('syncing');
    setServerMessage(`${connection.playerName} · 전체 대화 추가/수정/삭제를 서버에 반영하는 중`);

    try {
      const api = new PlayerSessionApiClient(connection.sessionId);
      const summaries = await api.listDialogues(connection.ownerUuid);
      const remoteByName = new Map(summaries.map((summary) => [serverNameKey(summary.name), summary]));

      for (const local of project.dialogues) {
        const remoteName = local.server?.remoteName || local.name;
        const current = remoteByName.get(serverNameKey(remoteName));
        if (
          local.server?.ownerUuid === connection.ownerUuid &&
          local.server.revision &&
          current &&
          local.server.revision !== current.revision
        ) {
          throw new RevisionConflictError(current.revision);
        }
      }

      for (const pending of project.pendingServerDeletes ?? []) {
        if (pending.ownerUuid !== connection.ownerUuid) continue;
        const current = remoteByName.get(serverNameKey(pending.remoteName));
        if (current)
          await api.deleteDialogue(connection.ownerUuid, current.name, pending.revision ?? current.revision);
      }

      const savedMetadata = new Map<
        string,
        { remoteName: string; revision: string; raw: Record<string, unknown> }
      >();
      for (const local of project.dialogues) {
        const remoteName = local.server?.remoteName || local.name;
        const payload = exportMinecraftDialogue(local, manifest);
        await api.validate(payload);
        const current = remoteByName.get(serverNameKey(remoteName));
        const expectedRevision =
          local.server?.ownerUuid === connection.ownerUuid && local.server.revision
            ? local.server.revision
            : current?.revision;
        const saved = await api.saveDialogue(
          connection.ownerUuid,
          remoteName,
          expectedRevision,
          payload,
        );
        await api.reloadDialogue(connection.ownerUuid, remoteName);
        savedMetadata.set(local.id, {
          remoteName,
          revision: saved.revision,
          raw: structuredClone(payload),
        });
      }

      mutateProject(project.id, (draft) => {
        for (const target of draft.dialogues) {
          const saved = savedMetadata.get(target.id);
          if (!saved) continue;
          target.server = {
            ownerUuid: connection.ownerUuid,
            remoteName: saved.remoteName,
            revision: saved.revision,
            raw: saved.raw,
            lastSyncedAt: new Date().toISOString(),
          };
        }
        draft.pendingServerDeletes = (draft.pendingServerDeletes ?? []).filter(
          (entry) => entry.ownerUuid !== connection.ownerUuid,
        );
      });
      setServerStatus('applied');
      setServerMessage(
        `${connection.playerName} · 서버 반영 완료 · 대화 ${project.dialogues.length}개 저장, 삭제 예약 처리 완료`,
      );
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        setServerStatus('conflict');
        setServerMessage(
          `서버 revision ${error.serverRevision.slice(0, 8)}가 변경되었습니다. '서버에서 불러오기' 후 다시 반영하세요.`,
        );
      } else {
        setServerStatus('error');
        setServerMessage(error instanceof Error ? error.message : '서버 반영에 실패했습니다.');
      }
    }
  };

  return (
    <main className="flex h-screen min-w-[1280px] flex-col overflow-hidden bg-[#0f1115] text-[#eef1f5]">
      {!testMode && (
        <StudioToolbar
          projectName={project.name}
          dialogueName={dialogue.name}
          saveStatus={saveStatus}
          serverStatus={serverStatus}
          serverMessage={serverMessage}
          issueCount={issues.length}
          errorCount={errorCount}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onBack={() => navigate('/')}
          onUndo={undo}
          onRedo={redo}
          onSave={() => void saveNow(project.id)}
          onTest={() => {
            setRightPanel(undefined);
            setTestMode(true);
          }}
          onValidate={() => setRightPanel({ kind: 'validation' })}
          onServer={() => void pullFromServer()}
          onApplyServer={() => void applyToServer()}
        />
      )}

      <div className="flex min-h-0 flex-1">
        {testMode ? (
          <TestMode dialogue={dialogue} manifest={manifest} onExit={() => setTestMode(false)} />
        ) : (
          <>
            <DialogueSidebar
              project={project}
              dialogue={dialogue}
              activePageId={page.id}
              issues={issues}
              onSelectDialogue={(target) => {
                selectDialogue(target.id, target.pages[0]?.id);
                resetHistory();
                setRightPanel(undefined);
              }}
              onCreateDialogue={createNewDialogue}
              onDeleteDialogue={deleteCurrentDialogue}
              onSelectPage={(pageId) => {
                selectPage(pageId);
                setRightPanel(undefined);
              }}
              onCreatePage={createNewPage}
              onDuplicatePage={duplicatePage}
              onDeletePage={deletePage}
            />

            <ScriptWorkspace
              page={page}
              pageNumber={dialogue.pages.findIndex((candidate) => candidate.id === page.id) + 1}
              manifest={manifest}
              variableNames={variableNames}
              activePanel={rightPanel?.kind === 'inspector' ? rightPanel.section : undefined}
              onOpenPanel={(section) => setRightPanel({ kind: 'inspector', section })}
              onChange={changePage}
            />

            {rightPanel?.kind === 'inspector' && rightPanel.section === 'effects' && (
              <EffectsInspector
                page={page}
                dialogue={dialogue}
                project={project}
                onClose={() => setRightPanel(undefined)}
                onChange={changePage}
              />
            )}

            {rightPanel?.kind === 'inspector' && rightPanel.section !== 'effects' && (
              <EditorInspector
                section={rightPanel.section}
                page={page}
                dialogue={dialogue}
                project={project}
                manifest={manifest}
                onClose={() => setRightPanel(undefined)}
                onChange={changePage}
              />
            )}

            {rightPanel?.kind === 'validation' && (
              <ValidationPanel
                issues={issues}
                project={project}
                onClose={() => setRightPanel(undefined)}
                onNavigate={navigateIssue}
              />
            )}
          </>
        )}
      </div>

      {serverModal && (
        <PlayerConnectionModal
          connection={connection}
          onClose={() => setServerModal(false)}
          onImport={importRemote}
        />
      )}
    </main>
  );
}
