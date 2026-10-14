import { jwtVerify, SignJWT, type JWTPayload } from 'jose';

export interface CreateSignedSessionTokenInput {
  subject: string;
  secret: Uint8Array;
  ttlSeconds: number;
  claims?: JWTPayload;
  issuedAt?: Date;
}

export interface VerifySignedSessionTokenInput<T extends JWTPayload> {
  token: string;
  secret: Uint8Array;
  requiredClaims: string[];
  invalidClaimsMessage: string;
  isValidClaims: (payload: JWTPayload) => payload is T;
}

export const createSignedSessionToken = async (
  input: CreateSignedSessionTokenInput,
): Promise<string> => {
  const issuedAtSeconds = Math.floor((input.issuedAt ?? new Date()).getTime() / 1000);

  return new SignJWT(input.claims ?? {})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.subject)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + input.ttlSeconds)
    .sign(input.secret);
};

export const verifySignedSessionToken = async <T extends JWTPayload>(
  input: VerifySignedSessionTokenInput<T>,
): Promise<T> => {
  const { payload } = await jwtVerify(input.token, input.secret, {
    algorithms: ['HS256'],
    requiredClaims: input.requiredClaims,
  });

  if (!input.isValidClaims(payload)) {
    throw new Error(input.invalidClaimsMessage);
  }

  return payload;
};
