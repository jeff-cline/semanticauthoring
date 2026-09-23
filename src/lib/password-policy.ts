// The password rule, in a module with no server-only import, because the
// signup form is a client component and must state the same number the server
// enforces. One constant, two runtimes, no drift.

export const MIN_PASSWORD = 9;

export const PASSWORD_HELP =
  `At least ${MIN_PASSWORD} characters, with upper case, lower case, and a number.`;
