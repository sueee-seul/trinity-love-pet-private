import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleIdentity {
  subject: string | null;
  email: string | null;
  name: string | null;
  picture: string | null;
  email_verified: boolean;
  given_name: string | null;
  family_name: string | null;
}

export const exchangeGoogleAuthorizationCode = async (
  authorizationCode: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string | null> => {
  const client = new OAuth2Client(clientId, clientSecret);
  const tokenResponse = await client.getToken({
    code: authorizationCode,
    redirect_uri: redirectUri,
  });
  const idToken = tokenResponse.tokens.id_token;

  return typeof idToken === 'string' && idToken.length > 0 ? idToken : null;
};

export const verifyGoogleIdToken = async (
  idToken: string,
  clientId: string,
): Promise<VerifiedGoogleIdentity | null> => {
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload) {
    return null;
  }

  return {
    subject: payload.sub ?? null,
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    email_verified: payload.email_verified === true,
    given_name: payload.given_name ?? null,
    family_name: payload.family_name ?? null,
  };
};
