import { useMemo, useState } from 'react';
import type { DialogueProject, DialoguePage } from '../../types/dialogue';
import { buildPreviewDialogue } from '../../services/dialoguePreview';

interface Props {
  project: DialogueProject;
  currentPageId?: string;
  onClose: () => void;
}

type PreviewStep = {
  kind: 'page' | 'choice';
  page: DialoguePage;
  choiceIndex?: number;
  lines: string[];
};

function linePreview(page: DialoguePage) {
  return page.lines.map((line) => line.text).filter(Boolean);
}

export function TestMode({ project, currentPageId, onClose }: Props) {
  const preview = useMemo(() => buildPreviewDialogue(project), [project]);
  const initial = useMemo(() => {
    const requested = currentPageId ? preview.pages.find((page) => page.id === currentPageId) : undefined;
    return requested ?? preview.pages[0];
  }, [currentPageId, preview.pages]);
  const [step, setStep] = useState<PreviewStep | null>(() =>
    initial ? { kind: 'page', page: initial, lines: linePreview(initial) } : null,
  );
  const [history, setHistory] = useState<PreviewStep[]>([]);

  if (!step) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6">
        <div className="w-full max-w-xl rounded border border-[#303846] bg-[#11151b] p-5 text-[#e6e9ee] shadow-2xl">
          <div className="text-lg font-semibold">테스트할 대사가 없습니다.</div>
          <button className="mt-4 rounded bg-[#2e3744] px-4 py-2" onClick={onClose}>닫기</button>
        </div>
      </div>
    );
  }

  const choices = step.kind === 'page' ? step.page.choices ?? [] : [];
  const nextId = step.page.nextPageId;

  const move = (next: PreviewStep) => {
    setHistory((value) => [...value, step]);
    setStep(next);
  };

  const goNext = () => {
    if (!nextId) return;
    const next = preview.pages.find((page) => page.id === nextId);
    if (next) move({ kind: 'page', page: next, lines: linePreview(next) });
  };

  const choose = (index: number) => {
    const choice = choices[index];
    if (!choice) return;
    const response = choice.responsePages?.flatMap((page) => page.lines.map((line) => line.text)).filter(Boolean) ?? [];
    const target = choice.targetPageId ? preview.pages.find((page) => page.id === choice.targetPageId) : undefined;
    if (response.length > 0) {
      move({ kind: 'choice', page: target ?? step.page, choiceIndex: index, lines: response });
      return;
    }
    if (target) move({ kind: 'page', page: target, lines: linePreview(target) });
    else if (!choice.endDialogue) goNext();
  };

  const continueChoice = () => {
    if (step.kind !== 'choice') return;
    const origin = history.at(-1);
    if (!origin) return;
    const choice = origin.page.choices?.[step.choiceIndex ?? -1];
    if (choice?.endDialogue) return;
    const target = choice?.targetPageId ? preview.pages.find((page) => page.id === choice.targetPageId) : undefined;
    if (target) {
      move({ kind: 'page', page: target, lines: linePreview(target) });
      return;
    }
    const next = origin.page.nextPageId ? preview.pages.find((page) => page.id === origin.page.nextPageId) : undefined;
    if (next) move({ kind: 'page', page: next, lines: linePreview(next) });
  };

  const canContinue = step.kind === 'choice'
    ? Boolean((() => {
        const origin = history.at(-1);
        const choice = origin?.page.choices?.[step.choiceIndex ?? -1];
        return choice && !choice.endDialogue && (choice.targetPageId || origin?.page.nextPageId);
      })())
    : choices.length === 0 && Boolean(nextId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded border border-[#303846] bg-[#0e1218] text-[#e6e9ee] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#252c36] bg-[#151a22] px-4 py-3">
          <div>
            <div className="font-semibold">대화 테스트 모드</div>
            <div className="text-[11px] text-[#6d7785]">
              서버에 저장하지 않고 현재 편집 데이터를 시뮬레이션합니다. 실제 서버에서는 F로 타이핑 전체 표시와 다음 진행을 모두 조작합니다.
            </div>
          </div>
          <button className="rounded bg-[#2b333f] px-3 py-1.5 text-sm hover:bg-[#35404f]" onClick={onClose}>닫기</button>
        </div>

        <div className="p-5">
          <div className="rounded border border-[#333c49] bg-[#080b10] p-5">
            <div className="mb-3 flex items-center justify-between gap-4 text-xs text-[#8994a4]">
              <span>{step.kind === 'page' ? step.page.speaker || '화자 없음' : '선택지 후속 대사'}</span>
              <span>{step.page.id}</span>
            </div>
            <div className="space-y-2 text-[15px] leading-7">
              {step.lines.length > 0 ? step.lines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div className="text-[#596270]">빈 대사</div>}
            </div>
          </div>

          {choices.length > 0 && (
            <div className="mt-4 space-y-2">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  className="block w-full rounded border border-[#343d49] bg-[#171d25] px-4 py-3 text-left hover:bg-[#202833]"
                  onClick={() => choose(index)}
                >
                  <span className="mr-2 text-[#7f8da1]">{index + 1}.</span>{choice.label || `선택지 ${index + 1}`}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              className="rounded bg-[#242c37] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              disabled={history.length === 0}
              onClick={() => {
                const previous = history.at(-1);
                if (!previous) return;
                setHistory((value) => value.slice(0, -1));
                setStep(previous);
              }}
            >
              ‹ 이전
            </button>
            <div className="text-xs text-[#6f7b8d]">
              실제 서버 조작: F · 타이핑 중 전체 표시 / 완료 후 다음 진행 · 수동 전체 표시 후 1초간 진행 잠금
            </div>
            <button
              className="rounded bg-[#315578] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canContinue}
              onClick={step.kind === 'choice' ? continueChoice : goNext}
            >
              F · 다음 ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
