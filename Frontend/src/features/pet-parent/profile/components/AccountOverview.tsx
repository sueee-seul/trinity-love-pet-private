import { useId, type ReactElement } from 'react';
import type { ParentProfileState } from '../types';
import { formatDate } from '../utils';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { ACCOUNT_COPY } from '../copy/accountCopy';
import { SECTION_TITLE } from '../../components/home/homeStyles';
import { Badge, Button, CARD_CLASS, DetailList, SectionCard, UserAvatar } from './ProfileUi';

/**
 * The Profile tab. Each detail is shown once: the identity card holds how Wagstay reaches the pet
 * parent (email, phone, address), and "At a glance" holds the rest. Both used to list the contact
 * details, so the same email and phone sat on screen twice.
 */
export function AccountOverview({
  profile,
  onEditProfile,
}: {
  profile: ParentProfileState;
  onEditProfile: () => void;
}): ReactElement {
  const { owner, pets } = profile;
  const nameId = useId();
  const locale = usePortalLocale();
  const copy = usePortalCopy(ACCOUNT_COPY).overview;
  // Shown for a detail the pet parent has not filled in yet.
  const notProvided = copy.notProvided;
  return (
    <>
      <section aria-labelledby={nameId} className={CARD_CLASS}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <UserAvatar name={owner.fullName} avatarUrl={owner.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 id={nameId} className={`${SECTION_TITLE} min-w-0 break-words`}>
                {owner.fullName}
              </h2>
              <Badge>{copy.petParentBadge}</Badge>
            </div>
            <div className="mt-4">
              <DetailList
                items={[
                  { label: copy.email, value: owner.email },
                  { label: copy.phone, value: owner.phone || notProvided },
                  { label: copy.address, value: owner.address || notProvided },
                ]}
              />
            </div>
            <Button variant="outline" className="mt-5" onClick={onEditProfile}>
              {copy.editProfile}
            </Button>
          </div>
        </div>
      </section>

      <SectionCard
        title={copy.atAGlance}
        meta={<span className="type-meta">{copy.petCount(pets.length)}</span>}
      >
        <DetailList
          items={[
            {
              label: copy.dateOfBirth,
              value: owner.dateOfBirth ? formatDate(owner.dateOfBirth, locale) : notProvided,
            },
            { label: copy.emergencyContact, value: owner.emergencyContactNumber || notProvided },
            {
              label: copy.petsOnFile,
              value:
                pets.length === 0
                  ? copy.noPetsYet
                  : pets.map((pet) => pet.name).join(copy.nameSeparator),
            },
          ]}
        />
      </SectionCard>
    </>
  );
}
