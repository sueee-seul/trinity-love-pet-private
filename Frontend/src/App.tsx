import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage, SignupPage } from './shared/auth';
import { AccountRoute, PortalRedirect } from './shared/auth/AccountRoute';
import { authApi } from './shared/auth/api/authApi';
import { useAuthStore } from './shared/auth/store/authStore';
import { ForgotPasswordPage } from './shared/auth/components/ForgotPasswordPage';
import {
  FirstLoginPasswordPage,
  ResetPasswordPage,
} from './shared/auth/components/FirstLoginPasswordPage';
import { PetHouseReviewPage } from './features/maps-review';
import {
  PetParentPortal,
  PetParentDashboardPage,
  PetParentFeedbackPage,
  VaccinationInfoPage,
  LiveCareDashboardPage,
  ProfilePage,
  PetProfilePage,
  MyStaysPage,
  AiChatPage,
} from './features/pet-parent';
import { AdminPortal } from './features/admin';
import { ConciergePage } from './features/concierge';
import { LandingPage } from './features/landing';
import { AccessibilityWidget } from './shared/accessibility';
import { BrandThemeRouteSync } from './shared/theme';
import { SiteLanguageProvider } from './app/SiteLanguageProvider';

function App(): React.ReactElement {
  useEffect(() => {
    let cancelled = false;
    useAuthStore.getState().setHydrating(true);

    const hydrateSession = async (): Promise<void> => {
      try {
        const result = await authApi.getCurrentUser();
        if (cancelled) {
          return;
        }

        const user = result.data.data?.user;
        if (result.ok && user) {
          useAuthStore.getState().login(user);
        } else {
          useAuthStore.getState().logout();
        }
      } catch {
        if (!cancelled) {
          useAuthStore.getState().logout();
        }
      } finally {
        if (!cancelled) {
          useAuthStore.getState().setHydrating(false);
        }
      }
    };

    void hydrateSession();

    return (): void => {
      cancelled = true;
    };
  }, []);

  return (
    <BrowserRouter>
      <SiteLanguageProvider>
        <BrandThemeRouteSync />
        <AccessibilityWidget />

        <Routes>
          {/* Public front page for guests and pet parents; staff are sent to their own side */}
          <Route path="/" element={<PortalRedirect publicPage={<LandingPage />} />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/first-login-password" element={<FirstLoginPasswordPage />} />

          {/* Public AI booking concierge: no account needed to plan, price and request a stay */}
          <Route path="/book" element={<ConciergePage variant="standalone" />} />

          {/* Standalone Google Maps review simulation */}
          <Route path="/maps/place/PetHouse/" element={<PetHouseReviewPage />} />

          {/* Pet Parent Routes */}
          <Route
            path="/parent"
            element={
              <AccountRoute identity="pet_owner">
                <div className="animate-in fade-in duration-500">
                  <PetParentPortal />
                </div>
              </AccountRoute>
            }
          >
            <Route index element={<PetParentDashboardPage />} />
            <Route path="feedback" element={<PetParentFeedbackPage />} />
            <Route path="vaccination/:bookingPetId" element={<VaccinationInfoPage />} />
            {/* Booking opens the AI concierge, which can reuse the parent's saved pets. */}
            <Route path="booking" element={<ConciergePage variant="portal" />} />
            <Route path="live-care" element={<LiveCareDashboardPage />} />
            <Route path="live-care/:bookingPetId" element={<LiveCareDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="pets/:id" element={<PetProfilePage />} />
            <Route path="stays" element={<MyStaysPage />} />
            <Route path="ai-chat" element={<AiChatPage />} />
          </Route>

          {/* Admin Website Routes */}
          <Route
            path="/admin/*"
            element={
              <AccountRoute identity="employee">
                <div className="animate-in fade-in duration-500">
                  <AdminPortal />
                </div>
              </AccountRoute>
            }
          />
        </Routes>
      </SiteLanguageProvider>
    </BrowserRouter>
  );
}

export default App;
