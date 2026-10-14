import {
  findReviewerById,
  upsertReviewerIdentity,
  type ReviewerIdentity,
} from '../repositories/reviewer.repository.js';
import {
  exchangeGoogleAuthorizationCode,
  verifyGoogleIdToken,
  type VerifiedGoogleIdentity,
} from './google-token.verifier.js';

export interface ReviewerProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SimulatorReviewerInput {
  authorKey: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

const toReviewerProfile = (reviewer: ReviewerIdentity): ReviewerProfile => ({
  id: reviewer.id,
  displayName: reviewer.display_name,
  avatarUrl: reviewer.avatar_url,
});

const getRequiredGoogleValue = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const toGoogleReviewerProfile = (
  identity: VerifiedGoogleIdentity | null,
): { profile: ReviewerProfile; providerSubject: string; email: string } | null => {
  if (!identity) {
    return null;
  }

  const subject = getRequiredGoogleValue(identity.subject);
  const email = getRequiredGoogleValue(identity.email);

  if (!subject || !email || identity.email_verified !== true) {
    return null;
  }

  const displayName = getRequiredGoogleValue(identity.name) ?? email;
  return {
    profile: {
      id: '',
      displayName,
      avatarUrl: identity.picture,
    },
    providerSubject: subject,
    email,
  };
};

export class ReviewerService {
  static async authenticateWithGoogle(
    idToken: string,
    clientId: string,
  ): Promise<ReviewerProfile | null> {
    let identity: VerifiedGoogleIdentity | null;
    try {
      identity = await verifyGoogleIdToken(idToken, clientId);
    } catch {
      return null;
    }

    const googleReviewer = toGoogleReviewerProfile(identity);
    if (!googleReviewer) {
      return null;
    }

    const reviewer = await upsertReviewerIdentity({
      provider: 'google',
      providerSubject: googleReviewer.providerSubject,
      email: googleReviewer.email,
      displayName: googleReviewer.profile.displayName,
      avatarUrl: googleReviewer.profile.avatarUrl,
    });

    return toReviewerProfile(reviewer);
  }

  static async authenticateWithGoogleCode(
    authorizationCode: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<ReviewerProfile | null> {
    let idToken: string | null;
    try {
      idToken = await exchangeGoogleAuthorizationCode(
        authorizationCode,
        clientId,
        clientSecret,
        redirectUri,
      );
    } catch {
      return null;
    }

    return idToken ? ReviewerService.authenticateWithGoogle(idToken, clientId) : null;
  }

  static async findProfileById(id: string): Promise<ReviewerProfile | null> {
    const reviewer = await findReviewerById(id);
    return reviewer ? toReviewerProfile(reviewer) : null;
  }

  static async upsertSimulatorReviewer(input: SimulatorReviewerInput): Promise<ReviewerProfile> {
    const reviewer = await upsertReviewerIdentity({
      provider: 'simulator',
      providerSubject: input.authorKey,
      email: input.email,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    });

    return toReviewerProfile(reviewer);
  }
}
