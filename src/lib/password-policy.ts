// The password rule, in a module with no server-only import, because the
// signup form is a client component and must state the same number the server
// enforces. One constant, two runtimes, no drift.
//
// This applies to passwords being SET — join, reset, change-password. It is
// never consulted at sign-in, so raising it does not lock out anyone whose
// password predates the change, and nothing here can force a reset.

export const MIN_PASSWORD = 12;

export const PASSWORD_HELP =
  `At least ${MIN_PASSWORD} characters, with upper case, lower case, and a number.`;
