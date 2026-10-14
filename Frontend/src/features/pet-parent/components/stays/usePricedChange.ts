import { useState } from 'react';
import { apiErrorCode, changedAmountOf, problemMessage } from './stayChangeRules';

interface PricedChangeOptions<Preview, Result> {
  /** Prices the change as it is chosen now (the GET). */
  preview: () => Promise<Preview>;
  /** Applies the change at the price shown (the POST, carrying the previewed amount). */
  apply: (preview: Preview) => Promise<Result>;
  onApplied: (result: Result) => void;
  /** The 409 code that means the amount moved while the dialog was open. */
  changedCode: string;
  /** The preview as it stands with the amount the refusal carries. */
  withNewAmount: (preview: Preview, amount: number) => Preview;
  copy: { amountChanged: string; checkFailed: string; applyFailed: string };
}

export interface PricedChange<Preview> {
  /** What the check found; null until a check succeeds or once the choice changes. */
  preview: Preview | null;
  checking: boolean;
  sending: boolean;
  problem: string | null;
  check: () => Promise<void>;
  confirm: () => Promise<void>;
  /** The choice changed, so the old price no longer applies. */
  reset: () => void;
}

/**
 * The two-step flow every priced change shares: check the price, then confirm at that price. When
 * the server answers that the amount moved, nothing was charged; the new amount replaces the old
 * one so the button names it, and the dialog asks once more.
 */
export function usePricedChange<Preview, Result>(
  options: PricedChangeOptions<Preview, Result>,
): PricedChange<Preview> {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const reset = (): void => {
    setPreview(null);
    setProblem(null);
  };

  const check = async (): Promise<void> => {
    setChecking(true);
    setProblem(null);
    try {
      setPreview(await options.preview());
    } catch (error) {
      setProblem(problemMessage(error, options.copy.checkFailed));
    } finally {
      setChecking(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (preview === null) return;
    setSending(true);
    setProblem(null);
    try {
      options.onApplied(await options.apply(preview));
    } catch (error) {
      const newAmount = changedAmountOf(error);
      if (apiErrorCode(error) === options.changedCode && newAmount !== null) {
        setPreview(options.withNewAmount(preview, newAmount));
        setProblem(options.copy.amountChanged);
      } else {
        setProblem(problemMessage(error, options.copy.applyFailed));
      }
    } finally {
      setSending(false);
    }
  };

  return { preview, checking, sending, problem, check, confirm, reset };
}
