import { useId, type ReactElement, type ReactNode } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import {
  NOTIFICATION_LOCALES,
  type NotificationPreferences,
  type NotificationPreferencesUpdate,
} from '../../types/notificationPreferences';
import { NOTIFICATION_PREFERENCES_COPY } from '../copy/notificationsCopy';
import {
  useNotificationPreferences,
  type NotificationPreferencesSave,
} from '../useNotificationPreferences';
import { Button, FIELD_LABEL_CLASS, SectionCard, inputClass } from './ProfileUi';

const HOURS_OF_DAY = Array.from({ length: 24 }, (_, hour) => hour);

/** Every hour of the day, worded in the page's language ("5:00 pm", or with the Chinese word for afternoon). */
function HourSelect({
  id,
  value,
  onChange,
  describedBy,
}: {
  id?: string;
  value: number;
  onChange: (hour: number) => void;
  describedBy?: string;
}): ReactElement {
  const copy = usePortalCopy(NOTIFICATION_PREFERENCES_COPY);
  return (
    <select
      id={id}
      className={`${inputClass} sm:w-36`}
      value={value}
      aria-describedby={describedBy}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {HOURS_OF_DAY.map((hour) => (
        <option key={hour} value={hour}>
          {copy.hour(hour)}
        </option>
      ))}
    </select>
  );
}

/** Each language as a pill, named in itself and marked as that language for screen readers. */
function LanguageChoice({
  value,
  onChange,
}: {
  value: NotificationPreferences['locale'];
  onChange: (locale: NotificationPreferences['locale']) => void;
}): ReactElement {
  const copy = usePortalCopy(NOTIFICATION_PREFERENCES_COPY);
  const groupName = useId();
  return (
    <div className="flex flex-wrap gap-2">
      {NOTIFICATION_LOCALES.map((locale) => {
        const isSelected = value === locale;
        return (
          <label
            key={locale}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-5 type-button transition-colors focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 ${
              isSelected
                ? 'border-action-dark bg-action-dark text-on-action-dark'
                : 'border-control-border bg-surface-card text-notice-secondary hover:border-action-dark hover:text-notice-primary'
            }`}
          >
            <input
              type="radio"
              name={groupName}
              value={locale}
              checked={isSelected}
              onChange={() => onChange(locale)}
              className="sr-only"
            />
            {copy.languageNames[locale]}
          </label>
        );
      })}
    </div>
  );
}

/** What the last change did, read out as it happens; Try again resends a change that failed. */
function SaveStatus({
  save,
  onRetry,
}: {
  save: NotificationPreferencesSave;
  onRetry: () => void;
}): ReactElement {
  const copy = usePortalCopy(NOTIFICATION_PREFERENCES_COPY);
  const words: Record<NotificationPreferencesSave['status'], string> = {
    idle: '',
    saving: copy.saving,
    saved: copy.saved,
    failed: copy.saveFailed,
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3">
      <p
        role="status"
        className={`type-meta m-0 ${save.status === 'failed' ? 'font-bold text-status-danger' : ''} ${save.status === 'saved' ? 'text-status-success' : ''}`}
      >
        {words[save.status]}
      </p>
      {save.status === 'failed' && (
        <Button variant="ghost" onClick={onRetry}>
          {copy.tryAgain}
        </Button>
      )}
    </div>
  );
}

/**
 * One setting as a row: what it is and one line on what it does on the left, the control on the
 * right. From `sm` the two sit side by side; on phones the control goes under the words.
 */
function SettingRow({
  title,
  titleFor,
  hint,
  hintId,
  children,
}: {
  title: string;
  /** The control's id, when the title labels one control; otherwise the row is a named group. */
  titleFor?: string;
  hint: string;
  hintId?: string;
  children: ReactNode;
}): ReactElement {
  const titleId = useId();
  return (
    <div
      role={titleFor ? undefined : 'group'}
      aria-labelledby={titleFor ? undefined : titleId}
      className="grid gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8"
    >
      <div className="min-w-0">
        {titleFor ? (
          <label htmlFor={titleFor} className="type-body block font-semibold text-notice-primary">
            {title}
          </label>
        ) : (
          <p id={titleId} className="type-body m-0 font-semibold text-notice-primary">
            {title}
          </p>
        )}
        <p id={hintId} className="type-meta m-0 mt-1 text-notice-muted">
          {hint}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function PreferenceFields({
  preferences,
  onChange,
}: {
  preferences: NotificationPreferences;
  onChange: (update: NotificationPreferencesUpdate) => void;
}): ReactElement {
  const copy = usePortalCopy(NOTIFICATION_PREFERENCES_COPY);
  const digestId = useId();
  const quietFromId = useId();
  const quietToId = useId();
  const quietHintId = useId();
  return (
    <div className="divide-y divide-border-soft">
      <SettingRow title={copy.language} hint={copy.languageHint}>
        <LanguageChoice value={preferences.locale} onChange={(locale) => onChange({ locale })} />
      </SettingRow>
      <SettingRow title={copy.digestHour} titleFor={digestId} hint={copy.digestHint}>
        <HourSelect
          id={digestId}
          value={preferences.digestHour}
          onChange={(digestHour) => onChange({ digestHour })}
        />
      </SettingRow>
      <SettingRow title={copy.quietHours} hint={copy.quietHint} hintId={quietHintId}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor={quietFromId} className={FIELD_LABEL_CLASS}>
            {copy.quietFrom}
          </label>
          <HourSelect
            id={quietFromId}
            value={preferences.quietStart}
            describedBy={quietHintId}
            onChange={(quietStart) => onChange({ quietStart })}
          />
          <label htmlFor={quietToId} className={FIELD_LABEL_CLASS}>
            {copy.quietTo}
          </label>
          <HourSelect
            id={quietToId}
            value={preferences.quietEnd}
            describedBy={quietHintId}
            onChange={(quietEnd) => onChange({ quietEnd })}
          />
        </div>
      </SettingRow>
      <SettingRow title={copy.emailTitle} hint={copy.emailHint}>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 cursor-pointer accent-action-dark"
            checked={preferences.emailUpdates}
            onChange={(event) => onChange({ emailUpdates: event.target.checked })}
          />
          <span className="type-body">{copy.emailUpdates}</span>
        </label>
      </SettingRow>
    </div>
  );
}

/**
 * The Profile tab's "Updates and notifications" card: the language the updates and emails are
 * written in, the hour the daily update arrives, the quiet hours and whether updates are emailed.
 * Each change is saved as it is made, so there is no Save button.
 */
export function NotificationPreferencesCard(): ReactElement {
  const copy = usePortalCopy(NOTIFICATION_PREFERENCES_COPY);
  const state = useNotificationPreferences();
  return (
    <SectionCard
      title={copy.title}
      // Each change saves itself, so how the last one went sits by the heading, not under a form.
      meta={
        state.status === 'ready' ? (
          <SaveStatus save={state.save} onRetry={state.retrySave} />
        ) : undefined
      }
    >
      {state.status === 'loading' && <p className="type-meta m-0">{copy.loading}</p>}
      {state.status === 'failed' && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="type-body m-0 font-bold text-status-danger">
            {copy.loadFailed}
          </p>
          <Button variant="outline" onClick={state.retry}>
            {copy.tryAgain}
          </Button>
        </div>
      )}
      {state.status === 'ready' && (
        <PreferenceFields preferences={state.preferences} onChange={state.change} />
      )}
    </SectionCard>
  );
}
