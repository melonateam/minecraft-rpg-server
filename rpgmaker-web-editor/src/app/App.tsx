import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminDialoguePage } from '../components/admin/AdminDialoguePage';
import { Dashboard } from '../components/dashboard/Dashboard';
import { DialogueStudioV2 } from '../components/editor/DialogueStudioV2';
import { connectPlayerSession } from '../services/playerSessionApi';
import { useProjectStore } from '../store/projectStore';

export function App() {
  const hydrated = useProjectStore((state) => state.hydrated);
  const hydrate = useProjectStore((state) => state.hydrate);

  useEffect(() => {
    // Reuse /rpgmaker web sessions, or ask the local API to match this address
    // to one online player before the user opens a project.
    void connectPlayerSession().catch(() => undefined);
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
      <Route path="/project/:projectId" element={<DialogueStudioV2 />} />
      <Route path="/admin" element={<AdminDialoguePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
