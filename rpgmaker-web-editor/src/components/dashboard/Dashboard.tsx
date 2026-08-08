import { useNavigate } from 'react-router-dom';
import { createDialogue } from '../../services/projectFactory';
import { useProjectStore } from '../../store/projectStore';

function formatRelative(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return '방금 수정';
  if (minutes < 60) return `${minutes}분 전 수정`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 수정`;
  return `${Math.floor(hours / 24)}일 전 수정`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const mutateProject = useProjectStore((state) => state.mutateProject);
  const workspace = projects[0];
  const dialogues = projects.flatMap((project) =>
    project.dialogues.map((dialogue) => ({ project, dialogue })),
  );

  const handleCreate = () => {
    if (!workspace) return;
    const entered = window.prompt('새 대화 이름', '새 대화');
    if (entered === null) return;
    const name = entered.trim();
    if (!name) {
      window.alert('대화 이름을 입력해 주세요.');
      return;
    }
    const duplicate = dialogues.some(
      ({ dialogue }) => dialogue.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicate) {
      window.alert(`'${name}' 이름의 대화가 이미 있습니다. 다른 이름을 사용해 주세요.`);
      return;
    }

    const next = createDialogue(name);
    mutateProject(workspace.id, (draft) => void draft.dialogues.push(next));
    navigate(`/project/${workspace.id}`);
  };

  const handleDelete = (projectId: string, dialogueId: string) => {
    const project = projects.find((candidate) => candidate.id === projectId);
    const dialogue = project?.dialogues.find((candidate) => candidate.id === dialogueId);
    if (!project || !dialogue) return;
    if (!window.confirm(`'${dialogue.name}' 대화를 삭제할까요?\n서버에 연결된 대화라면 다음 '서버에 반영' 때 서버에서도 삭제됩니다.`)) return;

    mutateProject(project.id, (draft) => {
      const target = draft.dialogues.find((candidate) => candidate.id === dialogue.id);
      if (target?.server?.ownerUuid && target.server.remoteName) {
        draft.pendingServerDeletes ??= [];
        const exists = draft.pendingServerDeletes.some(
          (entry) => entry.ownerUuid === target.server!.ownerUuid && entry.remoteName === target.server!.remoteName,
        );
        if (!exists) {
          draft.pendingServerDeletes.push({
            ownerUuid: target.server.ownerUuid,
            remoteName: target.server.remoteName,
            revision: target.server.revision,
          });
        }
      }
      draft.dialogues = draft.dialogues.filter((candidate) => candidate.id !== dialogue.id);
    });
  };

  return (
    <main className="min-h-screen bg-transparent px-12 py-10 text-[#eef4f8]">
      <header className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-[#26394a] bg-[#0d1721]/85 px-6 py-5 shadow-xl shadow-black/10 backdrop-blur">
        <div>
          <div className="text-sm font-semibold tracking-[0.18em] text-[#42d4d0]">RPGMAKER</div>
          <h1 className="mt-2 text-2xl font-semibold">대화</h1>
          <p className="mt-1 text-xs text-[#8091a1]">대화 제작 · 조건 · 효과 · 서버 동기화</p>
        </div>
        <button className="rounded-lg border border-[#33485b] bg-[#14202b] px-3 py-2 text-sm text-[#aab8c5] hover:border-[#9d8cff]/60 hover:bg-[#1a2734]">
          설정
        </button>
      </header>

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-[#8fa0ae]">웹과 Minecraft 서버에서 사용하는 대화 목록입니다.</p>
            <h2 className="mt-2 text-3xl font-semibold">대화 목록</h2>
          </div>
          <button
            onClick={handleCreate}
            disabled={!workspace}
            className="rounded-xl bg-gradient-to-r from-[#35bfc0] to-[#8f7cf6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#42d4d0]/10 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + 새 대화 추가
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {dialogues.map(({ project, dialogue }, index) => {
            const accents = ['#42d4d0', '#9d8cff', '#f1c66d'];
            const accent = accents[index % accents.length];
            return (
              <article
                key={`${project.id}:${dialogue.id}`}
                className="group relative overflow-hidden rounded-2xl border border-[#26394a] bg-[#101923]/92 p-5 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-[#4c6277] hover:bg-[#172331]"
              >
                <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: accent }} />
                <button className="w-full text-left" onClick={() => navigate(`/project/${project.id}`)}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                    <h3 className="truncate text-lg font-semibold">{dialogue.name}</h3>
                  </div>
                  <div className="mt-8 flex items-center justify-between text-sm">
                    <span className="text-[#a9b7c3]">페이지 {dialogue.pages.length}개</span>
                    <span className="rounded-full border border-[#31475a] bg-[#0c151e] px-2 py-1 text-[10px] text-[#758798]">
                      {dialogue.server?.remoteName ? 'SERVER LINKED' : 'WEB'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[#6f8292]">{formatRelative(project.updatedAt)}</div>
                </button>
                <div className="mt-4 flex items-center justify-between opacity-0 transition group-hover:opacity-100">
                  <span className="truncate text-[10px] text-[#627485]">{project.name}</span>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-[#91a0ad] hover:bg-red-400/10 hover:text-red-300"
                    onClick={() => handleDelete(project.id, dialogue.id)}
                  >
                    대화 삭제
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {dialogues.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-[#304659] bg-[#0d1721]/60 px-6 py-16 text-center text-sm text-[#8294a3]">
            아직 대화가 없습니다. 위의 ‘새 대화 추가’로 첫 대화를 만드세요.
          </div>
        )}
      </section>
    </main>
  );
}
