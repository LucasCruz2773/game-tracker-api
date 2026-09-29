export function toTestDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set to run the e2e tests');
  }

  const url = new URL(databaseUrl);
  const databaseName = url.pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    url.pathname = `/${databaseName}_test`;
  }

  return url.toString();
}
