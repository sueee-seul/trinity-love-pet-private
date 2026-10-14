import React, { useState } from 'react';
import {
  type FeedbackRatings,
  type RatingCategory,
  type FeedbackType,
  RATING_CATEGORIES,
} from '../../../shared/types/feedback';
import { FeedbackRatingSection } from '../components/feedback/FeedbackRatingSection';
import { FeedbackQuestionSection } from '../components/feedback/FeedbackQuestionSection';
import { submitPetParentFeedback, type FeedbackSubmissionResult } from '../api/feedbackApi';
import { useProfileState } from '../profile/useProfileState';
import { useProfileSync } from '../profile/useProfileSync';
import { PageHeader, PortalPage } from '../components/layout/PortalPage';
import {
  FEEDBACK_COPY,
  feedbackErrorText,
  type FeedbackFormError,
} from '../components/feedback/feedbackCopy';
import { usePortalCopy, usePortalLocale } from '../i18n/portalLocale';

interface FeedbackPageProps {
  onSubmitFeedback?: (payload: FeedbackSubmissionResult) => void | Promise<void>;
}

export const PetParentFeedbackPage: React.FC<FeedbackPageProps> = ({ onSubmitFeedback }) => {
  const copy = usePortalCopy(FEEDBACK_COPY);
  const locale = usePortalLocale();
  // The page can be opened directly (not just via the profile tab), so it
  // triggers its own load of the parent's real pets from the database. Repeat
  // calls across mounted screens are ignored after the first, per
  // `hydrateFromServer`'s contract.
  useProfileSync();
  // `null` while the profile is still loading. There is no local fixture, so
  // the picker simply has nothing to offer until the server answers.
  const pets = useProfileState()?.pets ?? [];

  // Defaults to the first pet until the parent explicitly picks another one,
  // without syncing that default through an effect: `pets` arrives
  // asynchronously (server hydration) and each render just falls back to
  // whatever it currently holds.
  const [chosenPetId, setChosenPetId] = useState<string>('');
  const selectedPetId = chosenPetId || (pets[0]?.id ?? '');
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;

  const [ratings, setRatings] = useState<FeedbackRatings>({
    Professional: 0,
    Service: 0,
    Communication: 0,
    Safety: 0,
    Cost: 0,
  });

  const [category, setCategory] = useState<FeedbackType | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<FeedbackFormError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleRatingChange = (category: RatingCategory, value: number): void => {
    setRatings((prev) => ({
      ...prev,
      [category]: value,
    }));
    if (error) setError(null);
  };

  const handleCategoryChange = (nextCategory: FeedbackType): void => {
    setCategory(nextCategory);
    setError(null);
  };

  const handleAnswerChange = (text: string): void => {
    setAnswer(text);
    if (error) setError(null);
  };

  const handleSubmit = async (): Promise<void> => {
    const missingRatings = RATING_CATEGORIES.filter((cat) => ratings[cat] === 0);
    const isMissingCategory = category === null;
    const isMissingAnswer = answer.trim() === '';

    const totalMissing =
      missingRatings.length + (isMissingCategory ? 1 : 0) + (isMissingAnswer ? 1 : 0);

    if (!selectedPet) {
      setError({ kind: 'noPet' });
      return;
    }

    if (totalMissing === 0 && category) {
      setError(null);
      setIsSent(false);
      setIsSubmitting(true);

      try {
        const selectedCategory = category;
        const data = await submitPetParentFeedback({
          pet_uuid: selectedPet.id,
          ratings,
          answer,
          category: selectedCategory,
          audioBlob,
        });

        if (onSubmitFeedback) {
          await onSubmitFeedback(data);
        } else {
          setIsSent(true);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? { kind: 'server', message: err.message }
            : { kind: 'submitFailed' },
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isMissingCategory && totalMissing === 1) {
      setError({ kind: 'missingCategory' });
    } else if (totalMissing > 1) {
      setError({ kind: 'incomplete' });
    } else {
      const [missingRating] = missingRatings;
      setError(
        missingRating
          ? { kind: 'missingRating', category: missingRating }
          : { kind: 'missingAnswer' },
      );
    }
  };

  return (
    <PortalPage width="narrow">
      <PageHeader title={copy.pageTitle} lead={copy.pageLead} />

      {pets.length > 1 && (
        <label className="block max-w-xs">
          <span className="type-meta font-semibold text-notice-secondary">{copy.petPicker}</span>
          <select
            value={selectedPetId}
            onChange={(event) => setChosenPetId(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-field-border bg-surface-card px-3 type-body text-notice-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <FeedbackRatingSection ratings={ratings} onRatingChange={handleRatingChange} />

      <FeedbackQuestionSection
        category={category}
        onCategoryChange={handleCategoryChange}
        answer={answer}
        onAnswerChange={handleAnswerChange}
        onAudioRecorded={setAudioBlob}
        onSubmit={handleSubmit}
        error={error ? feedbackErrorText(error, copy, locale) : null}
        isSubmitting={isSubmitting}
        successMessage={isSent ? copy.sent : null}
      />
    </PortalPage>
  );
};
