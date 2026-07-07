// Copy this file to `google.config.js` and fill in your Google OAuth Client ID.
// Keep `google.config.js` local. It is ignored by Git.

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const GOOGLE_DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.appdata";

window.IHM_GOOGLE_CONFIG = {
  clientId: GOOGLE_CLIENT_ID,
  driveScopes: GOOGLE_DRIVE_SCOPES
};
