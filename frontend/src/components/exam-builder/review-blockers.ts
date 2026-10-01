export interface ReadinessBlocker {
  key: string;
  ok: boolean;
  detail?: string;
}

/**
 * Readiness exposes import issues as one aggregate item. Replace that item
 * with the exact number of open provenance issues when those details exist.
 */
export function reviewBlockerCount(
  clientErrorCount: number,
  serverItems: ReadinessBlocker[],
  openImportIssueCount: number | null,
  serverError = false,
): number {
  const serverWithoutImportIssues = serverItems.filter(
    (item) => !item.ok && item.key !== "import_issues",
  ).length;
  const importFallback = serverItems.some(
    (item) => !item.ok && item.key === "import_issues",
  )
    ? 1
    : 0;

  return (
    clientErrorCount +
    serverWithoutImportIssues +
    (openImportIssueCount ?? importFallback) +
    (serverError ? 1 : 0)
  );
}
