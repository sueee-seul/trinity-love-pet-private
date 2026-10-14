import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLineTranslations,
  localiseLine,
  localiseLines,
  localiseReply,
  translationPrompt,
  type TranslationModel,
} from '../common/language/translate-lines.js';

const HANDOVER = 'A person has been asked to look at this and will reply here by 3:00 pm.';
const HANDOVER_KO = '담당자에게 확인을 요청했으며 오후 3:00까지 여기에서 답변드릴게요.';

/** A model that answers with the JSON array it is given, each line mapped through `translate`. */
const fakeModel = (
  translate: (line: string) => string,
): ReturnType<typeof vi.fn<TranslationModel>> =>
  vi.fn<TranslationModel>(async (_system, prompt) =>
    JSON.stringify((JSON.parse(prompt) as string[]).map(translate)),
  );

describe('localiseLines', () => {
  beforeEach(() => {
    clearLineTranslations();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('passes English and Chinese through without asking the model', async () => {
    const model = fakeModel(() => 'never');

    expect(await localiseLines([HANDOVER], 'en', model)).toEqual([HANDOVER]);
    expect(await localiseLines(['工作人员会回复你。'], 'zh', model)).toEqual([
      '工作人员会回复你。',
    ]);
    expect(model).not.toHaveBeenCalled();
  });

  it('translates once and then answers from the cache', async () => {
    const model = fakeModel(() => HANDOVER_KO);

    expect(await localiseLine(HANDOVER, 'ko', model)).toBe(HANDOVER_KO);
    expect(await localiseLine(HANDOVER, 'ko', model)).toBe(HANDOVER_KO);
    expect(model).toHaveBeenCalledTimes(1);
    const [system, prompt] = model.mock.calls[0] ?? [];
    expect(system).toBe(translationPrompt('ko'));
    expect(system).toContain('Korean (ko)');
    expect(system).toContain('Keep pet names');
    expect(JSON.parse(prompt ?? '[]')).toEqual([HANDOVER]);
  });

  it('returns the English line when the model fails, and logs no line text', async () => {
    const model = vi.fn<TranslationModel>(async () => {
      throw new Error('timeout');
    });

    expect(await localiseLine(HANDOVER, 'ko', model)).toBe(HANDOVER);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('3:00');
  });

  it('returns the English lines when the answer has the wrong number of lines', async () => {
    const model = vi.fn<TranslationModel>(async () => JSON.stringify(['하나', '둘']));

    expect(await localiseLines([HANDOVER], 'ko', model)).toEqual([HANDOVER]);
    expect(
      await localiseLines(
        [HANDOVER],
        'ko',
        vi.fn<TranslationModel>(async () => 'Sorry'),
      ),
    ).toEqual([HANDOVER]);
  });

  it('returns English when there is no model, and says so once', async () => {
    expect(await localiseLine(HANDOVER, 'ko', null)).toBe(HANDOVER);
    expect(await localiseLine(HANDOVER, 'ja', null)).toBe(HANDOVER);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});

describe('localiseReply', () => {
  beforeEach(() => clearLineTranslations());

  it('translates only the sentences not already in the reply language', async () => {
    const model = fakeModel(() => HANDOVER_KO);
    const reply = `Bella는 아침을 다 먹었어요. 산책도 했어요.\n\n${HANDOVER}`;

    expect(await localiseReply(reply, 'ko', model)).toBe(
      `Bella는 아침을 다 먹었어요. 산책도 했어요.\n\n${HANDOVER_KO}`,
    );
    expect(JSON.parse(model.mock.calls[0]?.[1] ?? '[]')).toEqual([HANDOVER]);
  });

  it('leaves a reply alone when every sentence is already in the language', async () => {
    const model = fakeModel(() => 'never');

    expect(await localiseReply('Bella는 잘 지내요. 😊', 'ko', model)).toBe('Bella는 잘 지내요. 😊');
    expect(model).not.toHaveBeenCalled();
  });
});
