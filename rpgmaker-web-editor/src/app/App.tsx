import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from '../components/dashboard/Dashboard';
import { DialogueStudioV2 } from '../components/editor/DialogueStudioV2';
import { capturePlayerSession } from '../services/playerSessionApi';
import { useProjectStore } from '../store/projectStore';

export function App() {
  const hydrated = useProjectStore((state) => state.hydrated);
  const hydrate = useProjectStore((state) => state.hydrate);

  useEffect(() => {
    // /rpgmaker web opens the editor root with ?session=... . Capture it before
    // the user navigates from the dashboard into a project so both import and
    // apply-to-server flows can authenticate with the same player session.
    capturePlayerSession();
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
