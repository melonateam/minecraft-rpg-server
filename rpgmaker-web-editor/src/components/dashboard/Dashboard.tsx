import { useNavigate } from 'react-router-dom';
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
  const createProject = useProjectStore((state) => state.createProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  const handleCreate = async () => {
    const name = window.prompt('새 프로젝트 이름', '새 RPG 프로젝트');
    if (name === null) return;
    const project = await createProject(name);
    navigate(`/project/${project.id}`);
  };

  return (
    <main className="min-h-screen bg-transparent px-12 py-10 text-[#eef4f8]">
      <header className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-[#26394a] bg-[#0d1721]/85 px-6 py-5 shadow-xl shadow-black/10 backdrop-blur">
        <div>
          <div className="text-sm font-semibold tracking-[0.18em] text-[#42d4d0]">RPGMAKER</div>
          <h1 className="mt-2 text-2xl font-semibold">프로젝트</h1>
          <p className="mt-1 text-xs text-[#8091a1]">대화 제작 · 조건 · 효과 · 서버 동기화</p>
        </div>
        <button className="rounded-lg border border-[#33485b] bg-[#14202b] px-3 py-2 text-sm text-[#aab8c5] hover:border-[#9d8cff]/60 hover:bg-[#1a2734]">
          설정
        </button>
      </header>

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-[#8fa0ae]">다시 오신 것을 환영합니다</p>
            <h2 className="mt-2 text-3xl font-semibold">최근 프로젝트</h2>
          </div>
          <button
            onClick={handleCreate}
            className="rounded-xl bg-gradient-to-r from-[#35bfc0] to-[#8f7cf6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#42d4d0]/10 hover:brightness-110"
          >
            + 새 프로젝트
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {projects.map((project, index) => {
            const accents = ['#42d4d0', '#9d8cff', '#f1c66d'];
            const accent = accents[index % accents.length];
            return (
              <article
                key={project.id}
                className="group relative overflow-hidden rounded-2xl border border-[#26394a] bg-[#101923]/92 p-5 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-[#4c6277] hover:bg-[#172331]"
              >
                <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: accent }} />
                <button className="w-full text-left" onClick={() => navigate(`/project/${project.id}`)}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                  </div>
                  <div className="mt-8 flex items-center justify-between text-sm">
                    <span className="text-[#a9b7c3]">대화 {project.dialogues.length}개</span>
                    <span className="rounded-full border border-[#31475a] bg-[#0c151e] px-2 py-1 text-[10px] text-[#758798]">WEB / SERVER</span>
                  </div>
                  <div className="mt-2 text-xs text-[#6f8292]">{formatRelative(project.updatedAt)}</div>
                </button>
                <div className="mt-4 flex justify-end opacity-0 transition group-hover:opacity-100">
                  <button
                    className="rounded-md px-2 py-1 text-xs text-[#91a0ad] hover:bg-red-400/10 hover:text-red-300"
                    onClick={() => {
                      if (window.confirm(`'${project.name}' 프로젝트를 삭제할까요?`)) void deleteProject(project.id);
                    }}
                  >
                    삭제
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
