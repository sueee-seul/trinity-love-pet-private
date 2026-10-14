import type { ReactElement } from 'react';
import { vaccinationCertificateUrl } from '../../api/bookingApi';

interface VaccinationCertificateLineProps {
  bookingPetsUuid: string;
  hasCertificate: boolean;
  uploadedAt: string | null;
}

const formatUploadDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Whether the parent uploaded this stay's vaccination certificate, with a link that opens it
 * through the staff-only endpoint. Without proof the pet is kept apart at drop-off (Code of
 * Welfare MS 4(c)), which the manager may want to plan for when approving.
 */
export function VaccinationCertificateLine({
  bookingPetsUuid,
  hasCertificate,
  uploadedAt,
}: VaccinationCertificateLineProps): ReactElement {
  return (
    <div className="mt-3">
      <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-muted">
        Vaccination certificate
      </p>
      {hasCertificate ? (
        <p className="type-meta text-notice-primary">
          {uploadedAt ? `Uploaded ${formatUploadDate(uploadedAt)}` : 'Uploaded'}
          {' · '}
          <a
            href={vaccinationCertificateUrl(bookingPetsUuid)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-notice-primary underline hover:text-accent-foreground-hover"
          >
            View certificate<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      ) : (
        <p className="type-meta text-status-danger">
          Not uploaded yet. Without proof at drop-off, the pet is kept apart from other pets.
        </p>
      )}
    </div>
  );
}
