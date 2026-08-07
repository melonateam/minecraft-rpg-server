import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Dialogue, DialoguePage } from '../../domain/project';
import { emptyServerPage } from '../../domain/serverSettings';
import {
  loadCharacterManifest,
  type CharacterManifest,
} from '../../services/characterRegistry';
import {
  MinecraftApiClient,
  RevisionConflictError,
  loadServerConnection,
  type ServerConnectionConfig,
  type ServerDialogueDocument,
} from '../../services/minecraftApi';
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
import { ScriptWorkspace } from './ScriptWorkspace';
import { ServerConnectionModal } from './ServerConnectionModal';
import {
  StudioToolbar,
  type ServerUiStatus,
} from './StudioToolbar';
import { ValidationPanel } from './ValidationPanel';

type RightPanel =
  | { kind: 'inspector'; section: InspectorSection }
  | { kind: 'validation' }
  | undefined;

function sectionForIssue(section: ValidationIssue['section']): InspectorSection | undefined {
  if (section === 'script') return undefined;
  if (section === 'character') return 'character';
  if (section === 'choices') return 'choices';
  if (section === 'condition') return 'condition';
  if (section === 'effects') return 'effects';
  if (section === 'flow') return 'flow';
  return 'other';
}

export function DialogueStudio() {
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
  const [serverConfig, setServerConfig] = useState<ServerConnectionConfig>(loadServerConnection);
  const [serverStatus, setServerStatus] = useState<ServerUiStatus>('disconnected');
  const [serverMessage, setServerMessage] = useState('');

  useEffect(() => {
    loadCharacterManifest()
      .then(setManifest)
      .catch((error) => setManifestError(error instanceof Error ? error.message : '캐릭터 리소스를 읽지 못했습니다.'));
  }, []);

  useEffect(() => {
    if (!project) return;
    const dialogue =
      project.dialogues.find((candidate) => candidate.id === activeDialogueId) ?? project.dialogues[0];
    if (dialogue && dialogue.id !== activeDialogueId)
      selectDialogue(dialogue.id, dialogue.pages[0]?.id);
  }, [project, activeDialogueId, selectDialogue]);

  useEffect(() => {
    resetHistory();
    setRightPanel(undefined);
    setTestMode(false);
  }, [projectId, resetHistory]);

  const dialogue =
    project?.dialogues.find((candidate) => candidate.id === activeDialogueId) ?? project?.dialogues[0];
  const page =
    dialogue?.pages.find((candidate) => candidate.id === activePageId) ?? dialogue?.pages[0];

  const issues = useMemo(
    () => (project && manifest ? validateProject(project, manifest) : []),
    [project, manifest],
  );
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;

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
    if (!dialogue || !serverConfig.ownerUuid || !dialogue.server?.remoteName) {
      setServerStatus('disconnected');
      return;
    }
    let cancelled = false;
    setServerStatus('connecting');
    const api = new MinecraftApiClient(serverConfig);
    void api
      .getDialogue(dialogue.server.remoteName)
      .then((remote) => {
        if (cancelled) return;
        if (dialogue.server?.revision && remote.revision !== dialogue.server.revision) {
          setServerStatus('stale');
          setServerMessage(`서버 revision ${remote.revision.slice(0, 8)}가 로컬 기준보다 최신입니다.`);
        } else {
          setServerStatus('connected');
          setServerMessage(`서버 revision ${remote.revision.slice(0, 8)}`);
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
  }, [dialogue?.id, dialogue?.server?.revision, dialogue?.server?.remoteName, serverConfig]);

  if (!project) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] text-[#9aa3af]">
        프로젝트를 찾을 수 없습니다.
      </main>
    );
  }

  if (!dialogue || !page) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] text-[#9aa3af]">
        대화 페이지를 찾을 수 없습니다.
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
    const next = createDialogue(`대화 ${project.dialogues.length + 1}`);
    mutateProject(project.id, (draft) => void draft.dialogues.push(next));
    selectDialogue(next.id, next.pages[0]?.id);
    setRightPanel(undefined);
  };

  const createNewPage = () => {
    if (dialogue.pages.length >= 10) return;
    const next = createPage(`Page ${dialogue.pages.length + 1}`);
    mutateProject(project.id, (draft) => {
      const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
      target?.pages.push(next);
    });
    selectPage(next.id);
  };

  const duplicatePage = (pageId: string) => {
    if (dialogue.pages.length >= 10) return;
    const source = dialogue.pages.find((candidate) => candidate.id === pageId);
    if (!source) return;
    const duplicate = structuredClone(source);
    duplicate.id = crypto.randomUUID();
    duplicate.editorLabel = `${source.editorLabel || `Page ${dialogue.pages.indexOf(source) + 1}`} 복사본`;
    duplicate.choices = duplicate.choices.map((choice) => ({ ...choice, id: crypto.randomUUID() }));
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
      candidate.choices.forEach((choice) => {
        if (choice.targetPageId === pageId)
          references.push(`Page ${index + 1} / 선택지 "${choice.label || '이름 없음'}"`);
      });
      if (candidate.server?.flow.nextPageId === pageId)
        references.push(`Page ${index + 1} / 다음 페이지`);
      if (candidate.server?.flow.conditionalTargetPageId === pageId)
        references.push(`Page ${index + 1} / 조건부 Jump`);
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
        candidate.choices.forEach((choice) => {
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

  const importRemote = async (
    document: ServerDialogueDocument,
    config: ServerConnectionConfig,
  ) => {
    const imported = importMinecraftDialogue(
      document.name,
      document.dialogue,
      document.revision,
      config.ownerUuid,
      manifest,
    );
    mutateProject(project.id, (draft) => {
      const existingIndex = draft.dialogues.findIndex(
        (candidate) =>
          candidate.server?.ownerUuid === config.ownerUuid &&
          candidate.server?.remoteName === document.name,
      );
      if (existingIndex >= 0) draft.dialogues[existingIndex] = imported;
      else draft.dialogues.push(imported);
    });
    selectDialogue(imported.id, imported.pages[0]?.id);
    setServerConfig(config);
    setServerStatus('connected');
    setServerMessage(`서버에서 ${document.name}을 불러왔습니다.`);
  };

  const applyToServer = async () => {
    if (errorCount > 0) {
      setRightPanel({ kind: 'validation' });
      setServerMessage('오류를 수정한 뒤 서버에 반영할 수 있습니다.');
      return;
    }
    if (!serverConfig.ownerUuid.trim()) {
      setServerModal(true);
      setServerMessage('먼저 서버 연결 정보와 대화 소유자 UUID를 설정하세요.');
      return;
    }

    const name = dialogue.server?.remoteName || dialogue.name;
    const payload = exportMinecraftDialogue(dialogue, manifest);
    setServerStatus('syncing');
    setServerMessage('웹 검증 → 서버 검증 → 저장 → reload 순서로 적용 중입니다.');

    try {
      const api = new MinecraftApiClient(serverConfig);
      await api.validate(payload);
      const saved = await api.saveDialogue(name, dialogue.server?.revision, payload);
      await api.reloadDialogue(name);
      mutateProject(project.id, (draft) => {
        const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
        if (!target) return;
        target.server = {
          ownerUuid: serverConfig.ownerUuid,
          remoteName: name,
          revision: saved.revision,
          raw: structuredClone(payload),
          lastSyncedAt: new Date().toISOString(),
        };
      });
      setServerStatus('applied');
      setServerMessage(`서버 반영 완료 · revision ${saved.revision.slice(0, 8)}`);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        setServerStatus('conflict');
        setServerMessage(
          `서버 revision ${error.serverRevision.slice(0, 8)}가 변경되었습니다. 서버에서 다시 불러온 뒤 병합하세요.`,
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
          onServer={() => setServerModal(true)}
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
              activePanel={rightPanel?.kind === 'inspector' ? rightPanel.section : undefined}
              onOpenPanel={(section) => setRightPanel({ kind: 'inspector', section })}
              onChange={changePage}
            />

            {rightPanel?.kind === 'inspector' && (
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
        <ServerConnectionModal
          onClose={() => setServerModal(false)}
          onConnected={(config) => {
            setServerConfig(config);
            setServerStatus('connected');
            setServerMessage('서버 연결됨');
          }}
          onImport={importRemote}
        />
      )}
    </main>
  );
}
