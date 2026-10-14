import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { createPet, updateOwner } from '../repository';
import { useProfileState } from '../useProfileState';
import { useProfileSync } from '../useProfileSync';
import { ProfileSyncNotice } from '../components/ProfileSyncNotice';
import type { PetFormInput } from '../types';
import { Modal } from '../components/ProfileModal';
import { OwnerForm, PetForm } from '../components/ProfileForms';
import { ParentProfileNav } from '../components/ParentProfileNav';
import { AccountOverview } from '../components/AccountOverview';
import { NotificationPreferencesCard } from '../components/NotificationPreferencesCard';
import { ContactsCard } from '../components/ContactsCard';
import { PetsSection } from '../components/PetsSection';
import { Button } from '../components/ProfileUi';
import {
  PARENT_STAYS_PATH,
  RETIRED_STAYS_TAB,
  isParentProfileTab,
  type ParentProfileTab,
} from '../parentProfileTabs';
import { PetParentSettingsModal } from '../../components/PetParentSettingsModal';
import { PageHeader, PortalPage } from '../../components/layout/PortalPage';
import { usePortalCopy } from '../../i18n/portalLocale';
import { ACCOUNT_COPY } from '../copy/accountCopy';

export function ProfilePage(): React.ReactElement {
  const profile = useProfileState();
  const sync = useProfileSync();
  const navigate = useNavigate();
  const copy = usePortalCopy(ACCOUNT_COPY);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingOwner, setEditingOwner] = useState(false);
  const [addingPet, setAddingPet] = useState(false);
  // Tab lives in the query string so a tab is linkable and survives a refresh. Emergency contacts
  // and Updates and notifications used to be cards on the Profile view; they have their own views
  // now (`?tab=contacts`, `?tab=updates`). No old link pointed at those cards, so none redirects.
  const tabParam = searchParams.get('tab');
  const activeTab: ParentProfileTab = isParentProfileTab(tabParam) ? tabParam : 'profile';

  /*
   * Account Settings is read from the URL for the same reason the tab is, and it has to be: the
   * accessibility toolbar links here with `?settings=open`, and it is pressed from this page as
   * often as from anywhere else. That is a same-route navigation (React Router updates the query
   * string without remounting), so local state seeded once at mount would leave the panel shut on
   * the one page whose own link it is. Derived state cannot miss it.
   */
  const isSettingsOpen = searchParams.get('settings') === 'open';

  // `replace` so closing the panel does not leave a history entry that reopens it on Back.
  const setSettingsOpen = (isOpen: boolean): void => {
    const next = new URLSearchParams(searchParams);
    if (isOpen) {
      next.set('settings', 'open');
    } else {
      next.delete('settings');
    }
    setSearchParams(next, { replace: true });
  };

  const changeTab = (tab: ParentProfileTab): void => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  const addPet = (value: PetFormInput): void => {
    setAddingPet(false);
    // The database assigns the id, so navigation waits for the server's answer.
    // A rejected write is already reported by the notice above, so the failure
    // is swallowed here rather than navigating to a pet that was never created.
    void createPet(value)
      .then((pet) => navigate(`/parent/pets/${pet.id}`))
      .catch(() => undefined);
  };

  if (tabParam === RETIRED_STAYS_TAB) {
    return <Navigate to={PARENT_STAYS_PATH} replace />;
  }

  return (
    <PortalPage width="standard">
      <PageHeader title={copy.pageTitle} lead={copy.pageLead} />

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <ParentProfileNav
          activeTab={activeTab}
          onChange={changeTab}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {profile ? (
            <ProfileSyncNotice sync={sync} />
          ) : (
            // No profile on screen means the load failed, not a save: say so, and offer the retry.
            <div className="flex flex-col items-start gap-4">
              <ProfileSyncNotice sync={sync} title={copy.loadFailedTitle} />
              {sync.error && <Button onClick={sync.retry}>{copy.tryAgain}</Button>}
            </div>
          )}

          {activeTab === 'profile' && profile && (
            <AccountOverview profile={profile} onEditProfile={() => setEditingOwner(true)} />
          )}

          {/* Each loads its own data, so it works even when the profile itself did not load. */}
          {activeTab === 'contacts' && <ContactsCard />}
          {activeTab === 'updates' && <NotificationPreferencesCard />}

          {activeTab === 'pets' && profile && (
            <PetsSection pets={profile.pets} onAddPet={() => setAddingPet(true)} />
          )}
        </div>
      </div>

      {editingOwner && profile && (
        <Modal title={copy.editProfileTitle} onClose={() => setEditingOwner(false)}>
          <OwnerForm
            owner={profile.owner}
            onCancel={() => setEditingOwner(false)}
            onSave={(value) => {
              setEditingOwner(false);
              // A rejected save is reported by the notice at the top of the
              // page; there is no local copy pretending it worked.
              void updateOwner(value).catch(() => undefined);
            }}
          />
        </Modal>
      )}
      {addingPet && (
        <Modal title={copy.addPetTitle} wide onClose={() => setAddingPet(false)}>
          <PetForm onCancel={() => setAddingPet(false)} onSave={addPet} />
        </Modal>
      )}
      <PetParentSettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </PortalPage>
  );
}
