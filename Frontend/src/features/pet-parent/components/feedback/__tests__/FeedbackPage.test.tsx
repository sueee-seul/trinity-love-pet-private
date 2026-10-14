import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PetParentFeedbackPage } from '../../../pages/PetParentFeedbackPage';
import { readProfileState, resetProfileState } from '../../../profile/repository';
import { useAuthStore } from '../../../../../shared/auth/store/authStore';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { englishWordsIn } from '../../../../../shared/i18n/testing/englishWordsIn';

// `vi.mock` is hoisted above the file's own consts, so the id the factory
// below uses has to be hoisted with it.
const { FIRST_PET_UUID } = vi.hoisted(() => ({
  FIRST_PET_UUID: '00000000-0000-4000-8000-000000000401',
}));

// The page resolves its own pet from the parent profile store, which is
// PostgreSQL-only. There is no fixture to fall back to, so the profile the
// page sees is the one this stubbed API call returns.
vi.mock('../../../profile/parentProfileApi', () => ({
  fetchParentProfile: vi.fn().mockResolvedValue({
    owner: {
      id: '00000000-0000-4000-8000-000000000101',
      fullName: 'Ava Mitchell',
      email: 'parent@example.test',
      phone: '',
      avatarUrl: null,
      address: '',
      dateOfBirth: null,
      emergencyContactNumber: '',
    },
    pets: [
      {
        id: FIRST_PET_UUID,
        ownerId: '00000000-0000-4000-8000-000000000101',
        name: 'Luna',
        species: 'DOG',
        desexed: false,
        allergies: [],
        medications: [],
        stays: [],
      },
    ],
  }),
}));

// A real signed-in pet owner, because that is what triggers the profile load.
const signIn = (): void => {
  useAuthStore.getState().login({
    email: 'parent@example.test',
    is_employee: false,
    is_pet_owner: true,
  });
};

// Mock global fetch to return our fake insights
globalThis.fetch = vi.fn();

describe('FeedbackPage (1-Step AI Flow)', () => {
  beforeEach(() => {
    // The profile cache is a module singleton; each test re-hydrates it.
    resetProfileState();
    signIn();
    vi.clearAllMocks();
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        uuid: '00000000-0000-4000-8000-000000000b16',
        pet_uuid: FIRST_PET_UUID,
        pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
        category: 'Issue',
        rating: 4.2,
        rating_details: {
          Professional: 5,
          Service: 5,
          Communication: 5,
          Safety: 3,
          Cost: 3,
        },
        raw_answer: 'The parent answer.',
        transcript: null,
        audio_url: null,
        ai_insights: {
          summary: 'LLM summary',
          insights: ['Insight 1: Fake summary', 'Insight 2: Fake summary'],
        },
      }),
    });
  });

  const fillForm = (container: HTMLElement): void => {
    // Fill Ratings
    const stars = container.querySelectorAll('svg');
    // Assuming each row has 5 stars, we click the 5th star for all 5 categories (indexes 4, 9, 14, 19, 24)
    fireEvent.click(stars[4]);
    fireEvent.click(stars[9]);
    fireEvent.click(stars[14]);
    fireEvent.click(stars[19]);
    fireEvent.click(stars[24]);

    fireEvent.click(screen.getByRole('radio', { name: 'Suggestion' }));

    // Fill Textareas
    const textareas = screen.getAllByPlaceholderText('Type your answer here…');
    fireEvent.change(textareas[0], { target: { value: 'Answer 1' } });
  };

  /**
   * The page's pet comes from the profile store, which is server-only now, so
   * it arrives a tick after render. Submitting before it lands would fail on
   * "Add a pet to your profile" rather than on what each test is checking.
   */
  const awaitProfile = async (): Promise<void> => {
    await waitFor(() => expect(readProfileState()?.pets).toHaveLength(1));
  };

  it('renders an unselected feedback type and updates the prompt after selection', () => {
    render(<PetParentFeedbackPage />);

    const suggestion = screen.getByRole('radio', { name: 'Suggestion' });
    expect(suggestion).not.toBeChecked();
    expect(
      screen.getByText('Share what you liked, what concerned you, or how we could improve.'),
    ).toBeInTheDocument();

    fireEvent.click(suggestion);

    expect(suggestion).toBeChecked();
    expect(screen.getByText('How could we improve your experience?')).toBeInTheDocument();
  });

  it('preserves typed feedback when the selected type changes', () => {
    render(<PetParentFeedbackPage />);

    const textarea = screen.getByPlaceholderText('Type your answer here…');
    fireEvent.change(textarea, { target: { value: 'Keep this feedback' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Praise' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Suggestion' }));

    expect(textarea).toHaveValue('Keep this feedback');
  });

  it('should fetch insights and submit form successfully', async () => {
    const mockSubmit = vi.fn();
    const { container } = render(<PetParentFeedbackPage onSubmitFeedback={mockSubmit} />);
    await awaitProfile();

    // Ensure we are on the form
    expect(screen.getByRole('heading', { level: 1, name: 'Leave feedback' })).toBeInTheDocument();

    fillForm(container);

    const submitBtn = screen.getByText('Submit feedback');
    fireEvent.click(submitBtn);

    // Should call fetch
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/feedback',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const [, requestInit] = (globalThis.fetch as Mock).mock.calls[0];
    const submittedPayload = JSON.parse(
      (requestInit.body as FormData).get('payload') as string,
    ) as {
      pet_uuid: string;
      category: string;
      rating_details: Record<string, number>;
      raw_answer: string;
    };
    expect(submittedPayload.pet_uuid).toBe(FIRST_PET_UUID);
    expect(submittedPayload).not.toHaveProperty('pet_owners_uuid');
    expect(submittedPayload.category).toBe('Suggestion');
    expect(submittedPayload.rating_details).toEqual({
      Professional: 5,
      Service: 5,
      Communication: 5,
      Safety: 5,
      Cost: 5,
    });
    expect(submittedPayload.raw_answer).toBe('Answer 1');
    expect('qna_list' in submittedPayload).toBe(false);
    expect('parentName' in submittedPayload).toBe(false);
    expect('petName' in submittedPayload).toBe(false);
    expect('serviceType' in submittedPayload).toBe(false);

    // Should call onSubmitFeedback with the fetched insights
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          insights: ['Insight 1: Fake summary', 'Insight 2: Fake summary'],
          summary: 'LLM summary',
          category: 'Suggestion',
        }),
      );
    });
  });

  it('shows the provider confirmation beside the submit action after success', async () => {
    const { container } = render(<PetParentFeedbackPage />);
    await awaitProfile();

    fillForm(container);
    fireEvent.click(screen.getByText('Submit feedback'));

    const confirmation = await screen.findByRole('status');
    const submitButton = screen.getByText('Submit feedback');

    expect(confirmation).toHaveTextContent('Your feedback has been sent to the provider.');
    expect(submitButton.parentElement).toContainElement(confirmation);
  });

  describe('FeedbackPage Validations', () => {
    it('shows error when a single star rating is missing', async () => {
      render(<PetParentFeedbackPage />);
      await awaitProfile();

      const submitBtn = screen.getByText('Submit feedback');

      // Fill all answers so only ratings are missing
      const textareas = screen.getAllByPlaceholderText('Type your answer here…');
      fireEvent.change(textareas[0], { target: { value: 'Answer 1' } });

      fireEvent.click(submitBtn);
      expect(
        screen.getByText('Form incomplete. Please ensure all ratings and questions are filled.'),
      ).toBeInTheDocument();
    });

    it('requires a feedback type before submitting a complete response', async () => {
      const { container } = render(<PetParentFeedbackPage />);
      await awaitProfile();
      const stars = container.querySelectorAll('svg');

      fireEvent.click(stars[4]);
      fireEvent.click(stars[9]);
      fireEvent.click(stars[14]);
      fireEvent.click(stars[19]);
      fireEvent.click(stars[24]);
      fireEvent.change(screen.getByPlaceholderText('Type your answer here…'), {
        target: { value: 'Answer 1' },
      });
      fireEvent.click(screen.getByText('Submit feedback'));

      expect(screen.getByText('Please choose a feedback category.')).toBeInTheDocument();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rates each area through its named star radio group, not only by clicking pictures', async () => {
      const mockSubmit = vi.fn();
      render(<PetParentFeedbackPage onSubmitFeedback={mockSubmit} />);
      await awaitProfile();

      // Native radios in a named group are what make the stars reachable by keyboard and screen reader.
      for (const area of ['Professional', 'Service', 'Communication', 'Safety', 'Cost']) {
        const group = screen.getByRole('radiogroup', { name: area });
        const fourStars = within(group).getByRole('radio', { name: '4 of 5 stars' });
        fireEvent.click(fourStars);
        expect(fourStars).toBeChecked();
      }
      fireEvent.click(screen.getByRole('radio', { name: 'Praise' }));
      fireEvent.change(screen.getByPlaceholderText('Type your answer here…'), {
        target: { value: 'Lovely stay.' },
      });
      fireEvent.click(screen.getByText('Submit feedback'));

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
      const [, requestInit] = (globalThis.fetch as Mock).mock.calls[0];
      const submittedPayload = JSON.parse(
        (requestInit.body as FormData).get('payload') as string,
      ) as { rating_details: Record<string, number> };
      expect(submittedPayload.rating_details).toEqual({
        Professional: 4,
        Service: 4,
        Communication: 4,
        Safety: 4,
        Cost: 4,
      });
    });

    it('enforces maxlength on textareas', () => {
      render(<PetParentFeedbackPage />);
      const textareas = screen.getAllByPlaceholderText('Type your answer here…');
      expect(textareas[0]).toHaveAttribute('maxLength', '2000');
    });

    it('calculates averageRating correctly and submits payload', async () => {
      const mockSubmit = vi.fn();
      const { container } = render(<PetParentFeedbackPage onSubmitFeedback={mockSubmit} />);
      await awaitProfile();

      const stars = container.querySelectorAll('svg');
      [4, 6, 12, 18, 20].forEach((index) => fireEvent.click(stars[index]));
      fireEvent.click(screen.getByRole('radio', { name: 'Suggestion' }));
      fireEvent.change(screen.getByPlaceholderText('Type your answer here…'), {
        target: { value: 'A clear answer.' },
      });
      fireEvent.click(screen.getByText('Submit feedback'));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: 4.2,
            summary: 'LLM summary',
            category: 'Suggestion',
          }),
        );
      });
    });
  });
});

describe('FeedbackPage in Chinese', () => {
  beforeEach(() => {
    resetProfileState();
    signIn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  // The pet arrives a tick after render, as in the English tests above.
  const awaitProfile = async (): Promise<void> => {
    await waitFor(() => expect(readProfileState()?.pets).toHaveLength(1));
  };

  it('shows the form in Chinese, keeps the stored keys, and switches back to English', async () => {
    useConciergeStore.getState().setLocale('zh');
    render(<PetParentFeedbackPage />);
    await awaitProfile();

    expect(screen.getByRole('heading', { level: 1, name: '留下反馈' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '为这次住宿打分' })).toBeInTheDocument();
    const professional = screen.getByRole('radiogroup', { name: '专业程度' });
    expect(
      within(professional).getByRole('radio', { name: '4 颗星，满分 5 颗星' }),
    ).toHaveAttribute('value', '4');
    fireEvent.click(screen.getByRole('radio', { name: '建议' }));
    expect(screen.getByRole('radio', { name: '建议' })).toHaveAttribute('value', 'Suggestion');
    expect(screen.getByText('我们怎样做能让你的体验更好？')).toBeInTheDocument();

    fireEvent.click(screen.getByText('提交反馈'));
    expect(screen.getByRole('alert')).toHaveTextContent('表单还没填完，请完成所有评分和问题。');

    // The error is kept as a reason, so it follows the reader into the other language.
    expect(englishWordsIn(document.body, [])).toEqual([]);
    act(() => useConciergeStore.getState().setLocale('en'));
    expect(screen.getByRole('heading', { level: 1, name: 'Leave feedback' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Form incomplete. Please ensure all ratings and questions are filled.',
    );
  });

  it('names the one missing area in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');
    render(<PetParentFeedbackPage />);
    await awaitProfile();

    for (const area of ['专业程度', '服务', '沟通', '安全']) {
      const group = screen.getByRole('radiogroup', { name: area });
      fireEvent.click(within(group).getByRole('radio', { name: '5 颗星，满分 5 颗星' }));
    }
    fireEvent.click(screen.getByRole('radio', { name: '表扬' }));
    fireEvent.change(screen.getByPlaceholderText('在这里输入你的回答…'), {
      target: { value: '很好' },
    });
    fireEvent.click(screen.getByText('提交反馈'));

    expect(screen.getByRole('alert')).toHaveTextContent('请为“费用”打分。');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
