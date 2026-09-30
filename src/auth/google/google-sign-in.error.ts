/** Sent to the frontend as `/login?error=<reason>` so it can show a helpful message. */
export type GoogleSignInFailureReason =
  | 'cancelled'
  | 'invalid_state'
  | 'google_rejected'
  | 'email_not_verified'
  | 'account_conflict'
  | 'unexpected_error';

export class GoogleSignInError extends Error {
  constructor(readonly reason: GoogleSignInFailureReason) {
    super(`Google sign-in failed: ${reason}`);
  }
}
