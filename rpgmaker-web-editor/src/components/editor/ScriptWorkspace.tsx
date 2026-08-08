import { useRef, useState } from 'react';
import type { DialoguePage } from '../../domain/project';
import {
  availableExpressions,
  getCharacter,
  normalizedGender,
  portraitSprite,
  type CharacterManifest,
  type ManifestExpression,
} from '../../services/characterRegistry';
import { visibleLength } from '../../services/projectValidator';
import { PortraitSprite } from '../characters/PortraitSprite';
import type { InspectorSection } from './EditorInspector';

interface Props {
  page: DialoguePage;
  pageNumber: number;
  manifest: CharacterManifest;
  variableNames?: string[];
  activePanel?: InspectorSection;
  onOpenPanel: (panel: InspectorSection) => void;
  onChange: (mutator: (page: DialoguePage) => void) => void;
}

const panelButtons: Array<[InspectorSection, string, string]> = [
  ['character', '캐릭터', '인물·표정'],
  ['choices', '선택지', '분기·결과'],
  ['condition', '조건', '표시 규칙'],
  ['effects', '효과', '아이템·변수'],
  ['flow', '페이지 흐름', '이동·종료'],
];

export function ScriptWorkspace({
  page,
  pageNumber,
  manifest,
  variableNames = [],
  activePanel,
  onOpenPanel,
  onChange,
}: Props) {
  const character = getCharacter(manifest, page.appearance.characterId);
  const gender = character ? normalizedGender(character, page.appearance.gender) : 'NONE';
  const expressions = character ? availableExpressions(character, gender) : [];
  const expression = expressions.includes(page.appearance.expression as ManifestExpression)
    ? (page.appearance.expression as ManifestExpression)
    : expressions[0];
  const sprite = character && expression ? portraitSprite(manifest, character, gender, expression) : undefined;
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [variableToInsert, setVariableToInsert] = useState(variableNames[0] ?? '');
  const lineRefs = useRef<Array<HTMLInputElement | null>>([]);

  const insertVariable = () => {
    const name = variableToInsert.trim();
    if (!name) return;
    const inputElement = lineRefs.current[activeLineIndex];
    const currentLine = page.lines[activeLineIndex] ?? '';
    const start = inputElement?.selectionStart ?? currentLine.length;
    const end = inputElement?.selectionEnd ?? start;
    const placeholder = `{{${name}}}`;
    onChange((draft) => {
      draft.lines[activeLineIndex] = `${currentLine.slice(0, start)}${placeholder}${currentLine.slice(end)}`;
    });
    requestAnimationFrame(() => {
      const next = start + placeholder.length;
      lineRefs.current[activeLineIndex]?.focus();
      lineRefs.current[activeLineIndex]?.setSelectionRange(next, next);
    });
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0f1216]">
      <div className="border-b border-[#20262e] px-8 py-4">
        <div className="mx-auto flex max-w-[920px] items-center gap-3">
          <span className="rounded-md bg-[#1d232b] px-2 py-1 text-[11px] font-semibold text-[#7e8896]">
            PAGE {pageNumber}
          </span>
          <input
            value={page.editorLabel ?? ''}
            onChange={(event) => onChange((draft) => void (draft.editorLabel = event.target.value))}
            placeholder={`Page ${pageNumber} 별칭`}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-[#eef1f5] outline-none placeholder:text-[#4f5866]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-[920px]">
          <div className="grid grid-cols-[140px_1fr] gap-7">
            <button
              type="button"
              onClick={() => onOpenPanel('character')}
              className={`group flex min-h-40 flex-col items-center justify-center rounded-2xl border p-4 transition ${
                activePanel === 'character'
                  ? 'border-[#7c8cff] bg-[#20263b]'
                  : 'border-[#252c35] bg-[#15191f] hover:border-[#38414e] hover:bg-[#191e25]'
              }`}
            >
              {page.appearance.visible && character ? (
                <>
                  <PortraitSprite sprite={sprite} size={94} />
                  <div className="mt-3 text-sm font-semibold">{character.label}</div>
                  <div className="mt-1 text-[11px] text-[#747e8d]">
                    {expression ? manifest.expressionLabels[expression] : ''}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-[#333b47] text-3xl text-[#555f6e]">
                    +
                  </div>
                  <div className="mt-3 text-xs text-[#7c8796]">캐릭터 선택</div>
                </>
              )}
            </button>

            <div className="min-w-0">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6e7887]">화자</label>
              <div className="mt-2 flex items-center rounded-xl border border-[#282f39] bg-[#15191f] px-4">
                <input
                  value={page.speaker}
                  onChange={(event) => onChange((draft) => void (draft.speaker = event.target.value))}
                  placeholder="화자 이름"
                  className="min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold outline-none placeholder:text-[#4f5865]"
                />
                <span className={`text-xs ${page.speaker.length > 10 ? 'text-red-400' : 'text-[#626c79]'}`}>
                  {page.speaker.length}/10
                </span>
              </div>

              {!page.appearance.visible && (
                <div className="mt-2 text-xs text-[#737e8c]">
                  캐릭터 표시가 꺼져 있어 게임에서는 화자도 숨겨집니다.
                </div>
              )}

              <div className="mt-7 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6e7887]">대사</label>
                <span className="text-xs text-[#626c79]">최대 4줄 · 줄당 표시 문자 30자</span>
              </div>

              <div className="mt-3 rounded-xl border border-[#283243] bg-[#141a22] p-3">
                <div className="flex items-center gap-2">
                  <input
                    list="dialogue-variable-names"
                    value={variableToInsert}
                    onChange={(event) => setVariableToInsert(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        insertVariable();
                      }
                    }}
                    placeholder="출력할 변수 이름"
                    className="min-w-0 flex-1 rounded-lg border border-[#303948] bg-[#101419] px-3 py-2 text-sm outline-none focus:border-[#7c8cff]"
                  />
                  <datalist id="dialogue-variable-names">
                    {variableNames.map((name) => <option key={name} value={name} />)}
                  </datalist>
                  <button
                    type="button"
                    onClick={insertVariable}
                    className="rounded-lg bg-[#2b3454] px-3 py-2 text-xs font-semibold text-[#c4cbff] hover:bg-[#35416b]"
                  >
                    변수 삽입
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-[#6f7b8b]">
                  선택한 대사 줄의 커서 위치에 <code className="text-[#9ca8ff]">{'{{변수명}}'}</code> 형식으로 삽입합니다.
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {page.lines.map((line, index) => {
                  const length = visibleLength(line);
                  const over = length > 30;
                  return (
                    <div
                      key={index}
                      className={`group grid grid-cols-[28px_1fr_60px] items-center gap-3 rounded-xl border px-3 transition ${
                        over
                          ? 'border-red-400/50 bg-red-400/5'
                          : 'border-[#282f39] bg-[#15191f] focus-within:border-[#7c8cff]'
                      }`}
                    >
                      <span className="text-center text-xs font-semibold text-[#5f6978]">{index + 1}</span>
                      <input
                        ref={(element) => {
                          lineRefs.current[index] = element;
                        }}
                        value={line}
                        onFocus={() => setActiveLineIndex(index)}
                        onChange={(event) =>
                          onChange((draft) => {
                            draft.lines[index] = event.target.value;
                          })
                        }
                        placeholder={index === 0 ? '대사를 입력하세요.' : '빈 줄'}
                        className="min-w-0 bg-transparent py-4 text-[15px] leading-6 outline-none placeholder:text-[#454e5b]"
                      />
                      <span className={`text-right text-[11px] ${over ? 'text-red-400' : 'text-[#616b78]'}`}>
                        {length}/30
                      </span>
                    </div>
                  );
                })}
              </div>

              {page.lines.some((line) => visibleLength(line) > 30) && (
                <div className="mt-3 rounded-lg bg-red-400/8 px-3 py-2 text-xs text-red-300">
                  Minecraft 표시 제한을 넘은 줄이 있습니다. 입력은 유지되지만 서버 반영 전에 수정해야 합니다.
                </div>
              )}
            </div>
          </div>

          <div className="my-8 h-px bg-[#20262e]" />

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6e7887]">필요한 기능 열기</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {panelButtons.map(([panel, title, description]) => {
                const count =
                  panel === 'choices'
                    ? page.choices.length
                    : panel === 'effects'
                      ? effectCount(page)
                      : panel === 'condition'
                        ? page.server?.displayCondition.mode !== 'none' && page.server?.displayCondition.mode
                          ? 1
                          : 0
                        : panel === 'flow'
                          ? flowCount(page)
                          : 0;
                return (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => onOpenPanel(panel)}
                    className={`rounded-xl border p-4 text-left transition ${
                      activePanel === panel
                        ? 'border-[#7c8cff] bg-[#20263b]'
                        : 'border-[#252c35] bg-[#15191f] hover:border-[#38414e] hover:bg-[#191e25]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{title}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-[#303855] px-2 py-0.5 text-[10px] text-[#aab4ff]">{count}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[#6f7987]">{description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {page.choices.length > 0 && (
            <>
              <div className="my-8 h-px bg-[#20262e]" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6e7887]">현재 선택지</div>
                  <button type="button" onClick={() => onOpenPanel('choices')} className="text-xs text-[#8b99ff]">
                    편집
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  {page.choices.map((choice, index) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => onOpenPanel('choices')}
                      className="flex items-center rounded-xl border border-[#252c35] bg-[#15191f] px-4 py-3 text-left hover:bg-[#191e25]"
                    >
                      <span className="mr-3 text-xs font-semibold text-[#7c8cff]">[{index + 1}]</span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {choice.label || <span className="text-[#596270]">이름 없는 선택지</span>}
                      </span>
                      <span className="text-xs text-[#687281]">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function effectCount(page: DialoguePage) {
  const effects = page.server?.effects;
  if (!effects) return 0;
  return [
    effects.giveItems,
    effects.takeItems,
    effects.variablesSet,
    effects.variablesDelete,
    effects.chatInputVariable,
    effects.sounds,
    effects.message,
    effects.returnTarget,
    effects.serverCommand,
  ].filter((value) => value.trim()).length;
}

function flowCount(page: DialoguePage) {
  const flow = page.server?.flow;
  if (!flow) return page.flow.ending ? 1 : 0;
  return [
    flow.nextPageId,
    flow.conditionalTargetPageId,
    flow.ending,
    page.server?.operationOnly,
  ].filter(Boolean).length;
}
