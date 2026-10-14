import type { ReactElement } from 'react';
import { usePortalLocale } from '../../i18n/portalLocale';

const GUIDE_COPY = {
  en: {
    title: 'How to capture a clear certificate',
    example: 'Document diagram · not a valid certificate',
    fields: ['Pet name', 'Vaccination date', 'Next due date'],
    hints: [
      'Keep the whole document inside the photo.',
      'Make names and dates readable; avoid glare.',
      'Upload the real certificate or vaccination record from your vet.',
    ],
  },
  zh: {
    title: '怎样拍清楚疫苗证明',
    example: '文件示意 · 不是有效证书',
    fields: ['宠物姓名', '接种日期', '下次到期日期'],
    hints: [
      '完整拍摄文件，避免裁掉边缘。',
      '让姓名和日期清晰可读，避免反光。',
      '上传兽医提供的真实证书或接种记录。',
    ],
  },
} as const;

/** An editable document diagram explains image quality without fabricating vaccination evidence. */
export function VaccinationUploadGuide(): ReactElement {
  const copy = GUIDE_COPY[usePortalLocale()];
  return (
    <details className="my-5 rounded-2xl border border-border-soft bg-surface-card p-5">
      <summary className="cursor-pointer type-body font-semibold">{copy.title}</summary>
      <div className="mt-4 grid items-start gap-5 sm:grid-cols-2">
        <figure className="m-0 rounded-xl border-2 border-dashed border-control-border bg-surface-cream p-4">
          <figcaption className="type-meta font-bold text-notice-secondary">
            {copy.example}
          </figcaption>
          <dl className="m-0 mt-4 flex flex-col gap-4">
            {copy.fields.map((field) => (
              <div key={field} className="border-b border-border-soft pb-2">
                <dt className="type-meta font-semibold">{field}</dt>
                <dd className="m-0 text-notice-muted">—</dd>
              </div>
            ))}
          </dl>
        </figure>
        <ol className="m-0 flex list-decimal flex-col gap-3 pl-5 type-meta text-notice-secondary">
          {copy.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}
