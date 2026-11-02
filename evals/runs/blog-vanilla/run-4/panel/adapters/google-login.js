// auth: google-login (recipes/google-login.md). The server verifies Google's token and sets the session.
import { createGoogleAuth } from "./auth.js";

export const createAuthAdapter = (request) => createGoogleAuth(request);
