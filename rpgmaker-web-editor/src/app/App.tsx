import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from '../components/dashboard/Dashboard';
import { DialogueStudio } from '../components/editor/DialogueStudio';
import { useProjectStore } from '../store/projectStore';

export function App() {
  const hydrated = useProjectStore((state) => state.hydrated);
  const hydrate = useProjectStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] text-[#a1a7b3]">
        프로젝트를 불러오는 중...
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/project/:projectId" element={<DialogueStudio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
