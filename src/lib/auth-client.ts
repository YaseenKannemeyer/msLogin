import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Empty string = always use relative URLs (same origin).
  // This avoids CORS issues regardless of where the app is deployed.
  baseURL: "",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
