export function requireTestDatabaseUrl(
  testDatabaseUrl: string | undefined,
): string {
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must be set to run the e2e tests');
  }

  const url = new URL(testDatabaseUrl);
  const databaseName = url.pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to use "${databaseName}": TEST_DATABASE_URL must target a *_test database`,
    );
  }

  return url.toString();
}
