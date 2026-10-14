import { useState } from 'react';
import { saveVaccination } from '../../api/vaccinationApi';
import type { VaccinationAnswer, VaccinationDetail } from '../../types/vaccination';
import {
  certificateFileProblem,
  saveFailureOf,
  type CertificateProblem,
  type SaveFailure,
} from './certificateFile';

export type AnswerChoice = 'yes' | 'no';

export interface VaccinationAnswerState {
  choice: AnswerChoice;
  file: File | null;
  fileProblem: CertificateProblem | null;
  saving: boolean;
  saveError: SaveFailure | null;
  saved: boolean;
  /** Yes needs a new valid file; No saves only to clear a certificate already on file. */
  canSave: boolean;
  choose: (choice: AnswerChoice) => void;
  pickFile: (file: File | null) => void;
  removeFile: () => void;
  save: () => Promise<void>;
}

/** What Save would send, or null while there is nothing to save. */
function answerToSave(
  choice: AnswerChoice,
  file: File | null,
  hasCertificate: boolean,
): VaccinationAnswer | null {
  if (choice === 'yes') return file ? { fullyVaccinated: true, certificate: file } : null;
  return hasCertificate ? { fullyVaccinated: false } : null;
}

/**
 * The page's answer and chosen file, and saving them. The answer starts at No unless a
 * certificate is already on file, so the page never shows Yes for proof we do not have.
 */
export function useVaccinationAnswer(
  detail: VaccinationDetail,
  onSaved: (detail: VaccinationDetail) => void,
): VaccinationAnswerState {
  const [choice, setChoice] = useState<AnswerChoice>(detail.certificate ? 'yes' : 'no');
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<CertificateProblem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const [saved, setSaved] = useState(false);

  const clearMessages = (): void => {
    setSaveError(null);
    setSaved(false);
  };

  const choose = (next: AnswerChoice): void => {
    clearMessages();
    setChoice(next);
  };

  // A rejected file is never kept, so Save cannot send it.
  const pickFile = (picked: File | null): void => {
    clearMessages();
    if (!picked) return;
    const problem = certificateFileProblem(picked);
    setFileProblem(problem);
    setFile(problem ? null : picked);
  };

  const removeFile = (): void => {
    clearMessages();
    setFileProblem(null);
    setFile(null);
  };

  const answer = answerToSave(choice, file, detail.certificate !== null);

  const save = async (): Promise<void> => {
    if (!answer || saving) return;
    clearMessages();
    setSaving(true);
    try {
      const updated = await saveVaccination(detail.bookingPetId, answer);
      setFile(null);
      setSaved(true);
      onSaved(updated);
    } catch (error: unknown) {
      setSaveError(saveFailureOf(error));
    } finally {
      setSaving(false);
    }
  };

  return {
    choice,
    file,
    fileProblem,
    saving,
    saveError,
    saved,
    canSave: answer !== null && !saving,
    choose,
    pickFile,
    removeFile,
    save,
  };
}
