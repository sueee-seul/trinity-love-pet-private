import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PetIntakeAssistant } from '../components/PetIntakeAssistant';
import { useDictation } from '../../../../shared/dictation';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';

vi.mock('../../../../shared/dictation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/dictation')>()),
  useDictation: vi.fn(),
}));

const mockedUseDictation = vi.mocked(useDictation);

/**
 * The assistant's contract is that nothing reaches the form until the owner confirms, and that
 * anything medical is confirmed on its own. The tests hold it to both, and to saying out loud what
 * it understood and what it translated.
 */
describe('PetIntakeAssistant', () => {
  const draft = { name: 'Mochi', species: 'DOG' as const, weightKg: 18, allergies: ['chicken'] };

  const respondWith = (data: unknown, ok = true): void => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<{ ok: boolean; json: () => Promise<unknown> }> => ({
        ok,
        json: async (): Promise<unknown> => data,
      })),
    );
  };

  beforeEach(() => {
    // The real hook is exercised by the dictation module's own tests; here it is stubbed so the
    // dictation wiring can be asserted without a microphone.
    mockedUseDictation.mockImplementation(({ value }) => ({
      status: 'idle',
      isSupported: true,
      displayText: value,
      interimText: '',
      error: null,
      toggle: vi.fn<() => Promise<void>>(),
      stop: vi.fn<() => Promise<void>>(),
    }));

    respondWith({ data: { draft, sourceLanguage: 'English' } });
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const type = (text: string): void => {
    fireEvent.change(screen.getByLabelText('Describe your pet'), { target: { value: text } });
  };

  const readIt = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Read it' }));
  };

  const describePet = (): void => {
    type('Mochi is a desexed border collie, 18kg, allergic to chicken');
    readIt();
  };

  it('will not send an empty or one-letter description', () => {
    render(<PetIntakeAssistant onDraft={vi.fn()} />);
    type(' x ');

    expect(screen.getByRole('button', { name: 'Read it' })).toBeDisabled();
  });

  it('reads a short fact in Chinese, which says a lot in few characters', () => {
    render(<PetIntakeAssistant onDraft={vi.fn()} />);
    type('体重是30千克');

    expect(screen.getByRole('button', { name: 'Read it' })).toBeEnabled();
  });

  it('offers dictation into the same box, wired to the description', () => {
    render(<PetIntakeAssistant onDraft={vi.fn()} />);
    type('Mochi is a border collie');

    expect(screen.getByRole('button', { name: 'Speak instead of typing' })).toBeInTheDocument();
    expect(mockedUseDictation).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'Mochi is a border collie' }),
    );
  });

  /* The whole point of the review step: reading it changes nothing until the owner says so. */
  it('does not touch the form until the draft is confirmed', async () => {
    const onDraft = vi.fn();
    render(<PetIntakeAssistant onDraft={onDraft} />);

    describePet();

    await waitFor(() => expect(screen.getByText(/Read 4 fields/)).toBeInTheDocument());
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('holds the confirm button until the medical details are ticked', async () => {
    const onDraft = vi.fn();
    render(<PetIntakeAssistant onDraft={onDraft} />);

    describePet();

    const confirm = await screen.findByRole('button', { name: 'Confirm and fill the form' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onDraft).toHaveBeenCalledWith(draft);
  });

  /* A draft with nothing medical in it has nothing to gate, so it must not invent a hurdle. */
  it('confirms in one press when there is nothing medical in the draft', async () => {
    const onDraft = vi.fn();
    const plain = { name: 'Rex', breed: 'Beagle' };
    respondWith({ data: { draft: plain, sourceLanguage: 'English' } });

    render(<PetIntakeAssistant onDraft={onDraft} />);
    describePet();

    const confirm = await screen.findByRole('button', { name: 'Confirm and fill the form' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onDraft).toHaveBeenCalledWith(plain);
  });

  it('separates the medical fields from the rest so they are read on their own', async () => {
    render(<PetIntakeAssistant onDraft={vi.fn()} />);
    describePet();

    const medical = await screen.findByRole('group', { name: 'Medical details to confirm' });
    expect(within(medical).getByText('Allergies')).toBeInTheDocument();
    expect(within(medical).getByText('chicken')).toBeInTheDocument();
    expect(within(medical).queryByText('Weight')).not.toBeInTheDocument();
  });

  /*
   * A form that quietly rewrote someone's words in a language they cannot check is worse than one
   * that did not try, so the translation has to announce itself.
   */
  it('says when it translated, and from what', async () => {
    respondWith({ data: { draft, sourceLanguage: 'Chinese' } });
    render(<PetIntakeAssistant onDraft={vi.fn()} />);

    describePet();

    expect(
      await screen.findByText(/Read in Chinese and translated to English/),
    ).toBeInTheDocument();
  });

  it('stays quiet about translation when the owner wrote in English', async () => {
    render(<PetIntakeAssistant onDraft={vi.fn()} />);
    describePet();

    await screen.findByRole('button', { name: 'Confirm and fill the form' });
    expect(screen.queryByText(/translated to English/)).not.toBeInTheDocument();
  });

  it('discards a draft without touching the form', async () => {
    const onDraft = vi.fn();
    render(<PetIntakeAssistant onDraft={onDraft} />);

    describePet();
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(
      screen.queryByRole('button', { name: 'Confirm and fill the form' }),
    ).not.toBeInTheDocument();
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('says so when nothing was recognised, rather than looking like it worked', async () => {
    respondWith({ data: { draft: {}, sourceLanguage: null } });
    render(<PetIntakeAssistant onDraft={vi.fn()} />);

    type('the weather today is quite nice actually');
    readIt();

    await waitFor(() => expect(screen.getByText(/Nothing recognised/)).toBeInTheDocument());
  });

  // The form still works by hand, so a failure here is a convenience lost, not a save lost.
  it('reports a failure and leaves the form alone', async () => {
    const onDraft = vi.fn();
    respondWith({ msg: 'Service unavailable' }, false);
    render(<PetIntakeAssistant onDraft={onDraft} />);

    type('Mochi is a desexed border collie, 18kg');
    readIt();

    await waitFor(() => expect(screen.getByText('Service unavailable')).toBeInTheDocument());
    expect(onDraft).not.toHaveBeenCalled();
  });

  // Only the panel is translated; the description is still sent as written.
  it('shows its panel in Chinese and names a translated language in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');
    respondWith({ data: { draft, sourceLanguage: 'Chinese' } });
    render(<PetIntakeAssistant onDraft={vi.fn()} />);

    expect(screen.getByText('也可以直接描述你的宠物')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用说话代替打字' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('描述你的宠物'), {
      target: { value: 'Mochi 是一只边境牧羊犬，18 公斤，对鸡肉过敏' },
    });
    fireEvent.click(screen.getByRole('button', { name: '读取' }));

    await waitFor(() =>
      expect(screen.getByText('读取到 4 项，请检查后确认。')).toBeInTheDocument(),
    );
    expect(screen.getByText('已按中文读取并翻译成英文，名字保持你写的原样。')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '需要确认的医疗信息' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认并填入表格' })).toBeDisabled();
  });

  // The form stays English for staff, but an owner cannot confirm an allergy they cannot read.
  it('asks for a Chinese read-back and shows it for the owner to check', async () => {
    useConciergeStore.getState().setLocale('zh');
    respondWith({
      data: {
        draft: { ...draft, species: 'DOG', breed: 'Border Collie' },
        sourceLanguage: 'Chinese',
        readBack: {
          breed: '边境牧羊犬',
          colour: null,
          dietNotes: null,
          allergies: ['鸡肉'],
          behaviourNotes: null,
          medicationInstructions: null,
        },
      },
    });
    const onDraft = vi.fn();
    render(<PetIntakeAssistant onDraft={onDraft} />);

    fireEvent.change(screen.getByLabelText('描述你的宠物'), {
      target: { value: 'Mochi 是一只边境牧羊犬，18 公斤，对鸡肉过敏' },
    });
    fireEvent.click(screen.getByRole('button', { name: '读取' }));

    expect(await screen.findByText('边境牧羊犬')).toBeInTheDocument();
    expect(screen.getByText('鸡肉')).toBeInTheDocument();
    expect(screen.getByText('狗狗')).toBeInTheDocument();
    expect(screen.queryByText('Border Collie')).not.toBeInTheDocument();
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ locale: 'zh' });
  });
});
