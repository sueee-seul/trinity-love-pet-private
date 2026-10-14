import React, { useEffect, useState } from 'react';
import { fetchHome } from '../api/homeApi';
import { HOME_COPY } from '../components/home/homeCopy';
import { HomeContent } from '../components/home/HomeContent';
import { PRIMARY_BUTTON } from '../components/home/homeStyles';
import { PortalPage } from '../components/layout/PortalPage';
import { usePortalCopy, usePortalLocale } from '../i18n/portalLocale';
import { requestErrorText } from '../i18n/requestErrorText';
import type { HomeData } from '../types/home';

// The failure is kept as thrown, so switching the language after it still changes the words.
type HomeLoad =
  { status: 'loading' } | { status: 'error'; cause: unknown } | { status: 'ready'; home: HomeData };

// The pet-parent homepage. It tells the parent what to do next: the server
// resolves which of the five states applies (GET /api/petparent/home) and this
// page renders it.
export const PetParentDashboardPage: React.FC = () => {
  const copy = usePortalCopy(HOME_COPY);
  const locale = usePortalLocale();
  const [load, setLoad] = useState<HomeLoad>({ status: 'loading' });
  // Bumped by "Try again" to re-run the fetch effect.
  const [attempt, setAttempt] = useState(0);

  const retry = (): void => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    fetchHome().then(
      (home) => {
        if (!cancelled) setLoad({ status: 'ready', home });
      },
      (err: unknown) => {
        if (!cancelled) setLoad({ status: 'error', cause: err });
      },
    );
    return (): void => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <PortalPage width="wide">
      {load.status === 'loading' && (
        <div role="status" className="flex flex-col items-center gap-3 py-24 text-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-border-soft border-t-accent-foreground"
            aria-hidden="true"
          />
          <p className="type-meta m-0">{copy.loading}</p>
        </div>
      )}

      {load.status === 'error' && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p role="alert" className="type-meta m-0 font-bold text-status-danger">
            {requestErrorText(load.cause, locale, copy.loadFailed)}
          </p>
          <button type="button" onClick={retry} className={PRIMARY_BUTTON}>
            {copy.tryAgain}
          </button>
        </div>
      )}

      {load.status === 'ready' && <HomeContent home={load.home} />}
    </PortalPage>
  );
};
