import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = "geocalc-64d8b";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export type GeoCalcUser = {
  uid: string;
  email: string | null;
  name: string | null;
};

export async function verifyGeoCalcUser(request: Request): Promise<GeoCalcUser | null> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], FIREBASE_JWKS, {
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
      algorithms: ["RS256"],
    });

    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid) return null;

    return {
      uid,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch (error) {
    console.warn("Firebase token verification failed", error);
    return null;
  }
}

