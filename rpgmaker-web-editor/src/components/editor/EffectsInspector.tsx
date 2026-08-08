import { useState, type ReactNode } from 'react';
import type { Dialogue, DialoguePage, RPGProject } from '../../domain/project';
import { emptyServerPage } from '../../domain/serverSettings';
import type { ServerPageSettings } from '../../domain/serverSettings';

interface Props {
  page: DialoguePage;
  dialogue: Dialogue;
  project: RPGProject;
  onClose: () => void;
  onChange: (mutator: (page: DialoguePage) => void) => void;
}

type VariableAssignment = {
  name: string;
  operator: '=' | '+=' | '-=' | '*=' | '/=';
  value: string;
};

const input =
  'w-full rounded-lg border border-[#2a3039] bg-[#171b21] px-3 py-2 text-sm text-[#eef1f5] outline-none transition focus:border-[#7c8cff]';
const label = 'text-xs font-medium text-[#919aa8]';

function parseAssignments(value: string): VariableAssignment[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^([A-Za-z0-9_.-]+)\s*(\+=|-=|\*=|\/=|=)\s*(.*)$/);
      return match
        ? {
            name: match[1],
            operator: match[2] as VariableAssignment['operator'],
            value: match[3],
          }
        : { name: entry, operator: '=', value: '' };
    });
}

function serializeAssignments(rows: VariableAssignment[]): string {
  return rows.map((row) => `${row.name}${row.operator}${row.value}`).join(', ');
}

function describeOperator(operator: VariableAssignment['operator']) {
  if (operator === '=') return '값을 설정';
  if (operator === '+=') return '현재 값에 더함';
  if (operator === '-=') return '현재 값에서 뺌';
  if (operator === '*=') return '현재 값에 곱함';
  return '현재 값을 나눔';
}

function pageLabel(dialogue: Dialogue, pageIndex: number) {
  const page = dialogue.pages[pageIndex];
  return page ? `페이지 ${pageIndex + 1} · ${page.editorLabel || page.lines.find(Boolean) || '빈 페이지'}` : `페이지 ${pageIndex + 1}`;
}

function selectedReturnLabel(dialogue: Dialogue, target: string) {
  const pageMatch = target.match(/^PAGE:p(\d+)$/i);
  if (pageMatch) return pageLabel(dialogue, Number(pageMatch[1]));

  const choiceMatch = target.match(/^CHOICE:p(\d+)#c(\d+)$/i);
  if (choiceMatch) {
    const pageIndex = Number(choiceMatch[1]);
    const choiceIndex = Number(choiceMatch[2]);
    const choice = dialogue.pages[pageIndex]?.choices[choiceIndex];
    return choice
      ? `${pageLabel(dialogue, pageIndex)} / 선택지 ${choiceIndex + 1} · ${choice.label || '이름 없음'}`
      : target;
  }
  return 'Return 사용 안 함';
}

function ReturnPicker({
  dialogue,
  value,
  onChange,
}: {
  dialogue: Dialogue;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-[#343c49] bg-[#12171d] px-3 py-3 text-left text-sm hover:border-[#596578]"
      >
        <span className="min-w-0 truncate">{selectedReturnLabel(dialogue, value)}</span>
        <span className="ml-3 text-[10px] text-[#7f8997]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-xl border border-[#343c49] bg-[#101419] p-2 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-[#9da6b3] hover:bg-[#20252d]"
          >
            Return 사용 안 함
          </button>

          {dialogue.pages.map((targetPage, pageIndex) => (
            <div key={targetPage.id} className="mt-1 border-t border-[#252b34] pt-1">
              <button
                type="button"
                onClick={() => {
                  onChange(`PAGE:p${pageIndex}`);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[#20252d]"
              >
                ↩ {pageLabel(dialogue, pageIndex)}
              </button>
              {targetPage.choices.map((choice, choiceIndex) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    onChange(`CHOICE:p${pageIndex}#c${choiceIndex}`);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg py-2 pl-7 pr-3 text-left text-xs text-[#b9c0cb] hover:bg-[#20252d]"
                >
                  └ 선택지 {choiceIndex + 1} · {choice.label || '이름 없음'}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EffectGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details open className="rounded-xl border border-[#292f39] bg-[#171b21] p-4">
      <summary className="cursor-pointer list-none">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-[11px] text-[#737d8b]">{description}</div>
      </summary>
      <div className="mt-4 space-y-3">{children}</div>
    </details>
  );
}

export function EffectsInspector({ page, dialogue, project, onClose, onChange }: Props) {
  const server = page.server ?? emptyServerPage();
  const variableRows = parseAssignments(server.effects.variablesSet);
  const edit = (mutator: (settings: ServerPageSettings) => void) =>
    onChange((draft) => {
      draft.server ??= emptyServerPage();
      mutator(draft.server);
    });

  const updateAssignment = (index: number, patch: Partial<VariableAssignment>) => {
    const rows = variableRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    edit((settings) => {
      settings.effects.variablesSet = serializeAssignments(rows);
    });
  };

  return (
    <aside className="flex w-[430px] shrink-0 flex-col border-l border-[#242a33] bg-[#12161b]">
      <header className="flex items-start gap-3 border-b border-[#242a33] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#f2f4f7]">효과</h2>
          <p className="mt-1 text-xs leading-5 text-[#77818f]">
            아이템, 변수, 사운드, 메시지, Return, 서버 명령을 기능별로 설정합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg px-2 py-1 text-[#788190] hover:bg-[#20252d] hover:text-white"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-[#334056] bg-[#18202c] p-3 text-xs leading-5 text-[#aeb8c8]">
          효과는 플레이어가 대사를 넘기거나 선택지를 확정할 때 한 번 실행됩니다.
        </div>

        <EffectGroup title="🎒 아이템" description="지급/회수 수량은 서버에서 항목당 최대 100개로 제한됩니다.">
          <label className={label}>
            지급
            <textarea
              className={`${input} mt-1.5 min-h-20 resize-y`}
              value={server.effects.giveItems}
              placeholder="minecraft:bread:3, @OWNER/custom_item:1"
              onChange={(event) => edit((settings) => void (settings.effects.giveItems = event.target.value))}
            />
          </label>
          <label className={label}>
            회수
            <textarea
              className={`${input} mt-1.5 min-h-20 resize-y`}
              value={server.effects.takeItems}
              placeholder="minecraft:emerald:2"
              onChange={(event) => edit((settings) => void (settings.effects.takeItems = event.target.value))}
            />
          </label>
        </EffectGroup>

        <EffectGroup title="{x} 변수" description="한 줄 문자열 대신 변수 이름 · 연산 · 값을 분리해 편집합니다.">
          {variableRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#343d4a] px-3 py-5 text-center text-xs text-[#737d8b]">
              아직 변수 연산이 없습니다.
            </div>
          )}
          <div className="space-y-2">
            {variableRows.map((row, index) => (
              <div key={`${index}-${row.name}`} className="rounded-xl border border-[#303846] bg-[#12171d] p-3">
                <div className="grid grid-cols-[1.15fr_72px_1fr_auto] gap-2">
                  <input
                    className={input}
                    list="rpgmaker-effect-variable-names"
                    value={row.name}
                    placeholder="변수 이름"
                    onChange={(event) => updateAssignment(index, { name: event.target.value })}
                  />
                  <select
                    className={input}
                    value={row.operator}
                    onChange={(event) =>
                      updateAssignment(index, { operator: event.target.value as VariableAssignment['operator'] })
                    }
                  >
                    <option value="=">=</option>
                    <option value="+=">+=</option>
                    <option value="-=">-=</option>
                    <option value="*=">*=</option>
                    <option value="/=">/=</option>
                  </select>
                  <input
                    className={input}
                    value={row.value}
                    placeholder="값"
                    onChange={(event) => updateAssignment(index, { value: event.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      edit((settings) => {
                        settings.effects.variablesSet = serializeAssignments(
                          variableRows.filter((_, rowIndex) => rowIndex !== index),
                        );
                      })
                    }
                    className="rounded-lg px-2 text-xs text-[#78818e] hover:bg-red-400/10 hover:text-red-300"
                  >
                    삭제
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-[#6f7b89]">
                  {row.name || '변수'} {row.operator} {row.value || '값'} · {describeOperator(row.operator)}
                </div>
              </div>
            ))}
          </div>

          <datalist id="rpgmaker-effect-variable-names">
            {project.variables.map((variable) => (
              <option key={variable.id} value={variable.name} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={() =>
              edit((settings) => {
                settings.effects.variablesSet = serializeAssignments([
                  ...variableRows,
                  { name: 'variable', operator: '=', value: '0' },
                ]);
              })
            }
            className="w-full rounded-xl border border-dashed border-[#3b4655] px-3 py-3 text-sm text-[#8b99ff] hover:bg-[#20252d]"
          >
            + 변수 연산 추가
          </button>

          <div className="grid gap-3 pt-1">
            <div className="rounded-xl border border-[#2d3541] bg-[#14191f] p-3">
              <div className="text-xs font-semibold text-[#c5cbd4]">변수 삭제</div>
              <div className="mt-1 text-[10px] text-[#707b89]">여러 변수는 쉼표로 구분합니다.</div>
              <input
                className={`${input} mt-2`}
                value={server.effects.variablesDelete}
                placeholder="temporary_hint, old_flag"
                onChange={(event) => edit((settings) => void (settings.effects.variablesDelete = event.target.value))}
              />
            </div>
            <div className="rounded-xl border border-[#2d3541] bg-[#14191f] p-3">
              <div className="text-xs font-semibold text-[#c5cbd4]">채팅 입력 → 변수 저장</div>
              <div className="mt-1 text-[10px] text-[#707b89]">
                플레이어가 채팅으로 입력한 값을 지정 변수에 저장합니다.
              </div>
              <input
                className={`${input} mt-2`}
                list="rpgmaker-effect-variable-names"
                value={server.effects.chatInputVariable}
                placeholder="nickname"
                onChange={(event) => edit((settings) => void (settings.effects.chatInputVariable = event.target.value))}
              />
            </div>
          </div>
        </EffectGroup>

        <EffectGroup title="🔊 사운드" description="sound id : pitch : volume : repeat(1~10)">
          <textarea
            className={`${input} min-h-20 resize-y`}
            value={server.effects.sounds}
            placeholder="minecraft:entity.villager.yes:1.0:0.8:1"
            onChange={(event) => edit((settings) => void (settings.effects.sounds = event.target.value))}
          />
        </EffectGroup>

        <EffectGroup title="💬 메시지" description="{{variable}} placeholder와 HEX 색상을 사용할 수 있습니다.">
          <label className={label}>
            메시지
            <input
              className={`${input} mt-1.5`}
              value={server.effects.message}
              placeholder="{{player}}님, 완료되었습니다."
              onChange={(event) => edit((settings) => void (settings.effects.message = event.target.value))}
            />
          </label>
          <label className={label}>
            색상
            <div className="mt-1.5 flex gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded-lg border border-[#2a3039] bg-[#171b21] p-1"
                value={/^#[0-9a-f]{6}$/i.test(server.effects.messageColor) ? server.effects.messageColor : '#ffffff'}
                onChange={(event) => edit((settings) => void (settings.effects.messageColor = event.target.value))}
              />
              <input
                className={input}
                value={server.effects.messageColor}
                placeholder="#FFFFFF"
                onChange={(event) => edit((settings) => void (settings.effects.messageColor = event.target.value))}
              />
            </div>
          </label>
        </EffectGroup>

        <EffectGroup title="↩ Return" description="돌아갈 페이지나 선택지 화면을 목록에서 직접 선택합니다.">
          <ReturnPicker
            dialogue={dialogue}
            value={server.effects.returnTarget}
            onChange={(value) => edit((settings) => void (settings.effects.returnTarget = value))}
          />
          <div className="rounded-lg bg-[#12171d] px-3 py-2 text-[11px] leading-5 text-[#778291]">
            페이지를 선택하면 해당 페이지로 돌아갑니다. 선택지를 선택하면 해당 페이지의 선택지 화면을 다시 엽니다.
          </div>
        </EffectGroup>

        <EffectGroup title="⌨ 서버 명령어 · OP 전용" description="{player}, {target} placeholder를 지원합니다.">
          <textarea
            className={`${input} min-h-20 resize-y`}
            value={server.effects.serverCommand}
            placeholder="give {player} minecraft:diamond 1"
            onChange={(event) => edit((settings) => void (settings.effects.serverCommand = event.target.value))}
          />
          <select
            className={input}
            value={server.effects.commandTarget}
            onChange={(event) =>
              edit((settings) => {
                settings.effects.commandTarget = event.target.value as ServerPageSettings['effects']['commandTarget'];
              })
            }
          >
            <option value="player">PLAYER · 대화 플레이어</option>
            <option value="all">ALL · 모든 플레이어</option>
            <option value="nearest">NEAREST · 가장 가까운 플레이어</option>
          </select>
        </EffectGroup>
      </div>
    </aside>
  );
}
