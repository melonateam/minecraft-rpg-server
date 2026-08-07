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
    <main className="min-h-screen bg-[#0f1115] px-12 py-10 text-[#f3f4f6]">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <div className="text-sm font-semibold tracking-[0.18em] text-[#7c8cff]">RPGMAKER</div>
          <h1 className="mt-2 text-2xl font-semibold">프로젝트</h1>
        </div>
        <button className="rounded-lg px-3 py-2 text-sm text-[#a1a7b3] hover:bg-[#1d2129]">설정</button>
      </header>

      <section className="mx-auto mt-16 max-w-6xl">
        <p className="text-sm text-[#a1a7b3]">다시 오신 것을 환영합니다</p>
        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-3xl font-semibold">최근 프로젝트</h2>
          <button
            onClick={handleCreate}
            className="rounded-xl bg-[#7c8cff] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            + 새 프로젝트
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {projects.map((project) => (
            <article key={project.id} className="group rounded-2xl bg-[#16191f] p-5 transition hover:bg-[#1d2129]">
              <button className="w-full text-left" onClick={() => navigate(`/project/${project.id}`)}>
                <h3 className="text-lg font-semibold">{project.name}</h3>
                <div className="mt-8 text-sm text-[#a1a7b3]">대화 {project.dialogues.length}개</div>
                <div className="mt-1 text-xs text-[#6f7683]">{formatRelative(project.updatedAt)}</div>
              </button>
              <div className="mt-4 flex justify-end opacity-0 transition group-hover:opacity-100">
                <button
                  className="rounded-md px-2 py-1 text-xs text-[#a1a7b3] hover:bg-[#2a2f39] hover:text-red-300"
                  onClick={() => {
                    if (window.confirm(`'${project.name}' 프로젝트를 삭제할까요?`)) void deleteProject(project.id);
                  }}
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
