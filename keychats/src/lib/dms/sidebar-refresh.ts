export function shouldRefreshForUnknownDmThread(
  dmThreadId: string | null,
  knownDmIds: ReadonlySet<string>,
) {
  return Boolean(dmThreadId && !knownDmIds.has(dmThreadId))
}
