import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  connectPlayerSession,
  PlayerSessionApiClient,
  type AdminDialogueOwner,
  type PlayerSessionConnection,
  type ServerDialogueSummary,
} from '../../services/playerSessionApi';

export function AdminDialoguePage() {
  const navigate = useNavigate();
  const [connection, setConnection] = useState<PlayerSessionConnection>();
  const [owners, setOwners] = useState<AdminDialogueOwner[]>([]);
  const [selected, setSelected] = useState<string>();
  const [dialogues, setDialogues] = useState<ServerDialogueSummary[]>([]);
  const [message, setMessage] = useState('OP 권한을 확인하는 중입니다.');

  useEffect(() => {
    void connectPlayerSession().then(async (next) => {
      if (!next?.admin) {
        setMessage('접속 중인 OP 플레이어만 사용할 수 있습니다.');
        return;
      }
      setConnection(next);
      const list = await new PlayerSessionApiClient(next.sessionId).listDialogueOwners();
      setOwners(list);
      setMessage('');
    }).catch((error) => setMessage(error instanceof Error ? error.message : '관리자 정보를 불러오지 못했습니다.'));
  }, []);

  async function selectOwner(ownerUuid: string) {
    if (!connection) return;
    setSelected(ownerUuid);
    setDialogues(await new PlayerSessionApiClient(connection.sessionId).listDialogues(ownerUuid));
  }

  async function deleteDialogue(dialogue: ServerDialogueSummary) {
    if (!connection || !selected || !window.confirm(`'${dialogue.title}' 대화를 삭제할까요?`)) return;
    const api = new PlayerSessionApiClient(connection.sessionId);
    await api.deleteDialogue(selected, dialogue.name, dialogue.revision);
    setDialogues(await api.listDialogues(selected));
    setOwners(await api.listDialogueOwners());
  }

  return (
    <main className="min-h-screen bg-[#0f1115] p-6 text-[#eef1f5]">
      <header className="mx-auto flex max-w-6xl items-center gap-4">
        <button type="button" onClick={() => navigate('/')} className="rounded-lg px-3 py-2 text-[#9ba5b3] hover:bg-[#20252d]">← 돌아가기</button>
        <h1 className="text-xl font-semibold">대화 관리자</h1>
      </header>

      {message ? <p className="mx-auto mt-10 max-w-6xl rounded-xl border border-[#303846] bg-[#151a21] p-5 text-[#aab2bd]">{message}</p> : (
        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-[280px_1fr] gap-5">
          <aside className="rounded-xl border border-[#303846] bg-[#151a21] p-3">
            <h2 className="px-2 pb-3 text-sm font-semibold text-[#aab2ff]">플레이어</h2>
            {owners.map((owner) => (
              <button key={owner.ownerUuid} type="button" onClick={() => void selectOwner(owner.ownerUuid)} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#252c36] ${selected === owner.ownerUuid ? 'bg-[#252c36]' : ''}`}>
                <span className="block truncate">{owner.playerName}</span>
                <span className="text-xs text-[#737e8d]">대화 {owner.dialogues}개</span>
              </button>
            ))}
          </aside>

          <section className="rounded-xl border border-[#303846] bg-[#151a21] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#aab2ff]">저장된 대화</h2>
            {!selected && <p className="text-sm text-[#737e8d]">플레이어를 선택하세요.</p>}
            {dialogues.map((dialogue) => (
              <div key={dialogue.name} className="mb-2 flex items-center rounded-lg border border-[#2a313c] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{dialogue.title}</p>
                  <p className="text-xs text-[#737e8d]">{dialogue.name} · {dialogue.pages}페이지</p>
                </div>
                <button type="button" onClick={() => void deleteDialogue(dialogue)} className="rounded-lg px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">삭제</button>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
