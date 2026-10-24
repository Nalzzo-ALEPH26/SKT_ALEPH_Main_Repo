export type SidebarCommunity = {
  id: string
  name: string
  pinnedAt?: string | null
  isNotice?: boolean
}

function pinnedTimestamp(value: string | null | undefined) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function sortSidebarCommunities(communities: SidebarCommunity[]) {
  return [...communities].sort((left, right) => {
    if (Boolean(left.isNotice) !== Boolean(right.isNotice)) return left.isNotice ? -1 : 1
    const leftPin = pinnedTimestamp(left.pinnedAt)
    const rightPin = pinnedTimestamp(right.pinnedAt)
    if (leftPin !== null && rightPin !== null) return rightPin - leftPin
    if (leftPin !== null) return -1
    if (rightPin !== null) return 1
    return 0
  })
}

function normalizePath(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? pathname
  if (withoutQuery.length > 1) return withoutQuery.replace(/\/+$/, '')
  return withoutQuery
}

export function isSidebarHrefActive(pathname: string, href: string) {
  const current = normalizePath(pathname)
  const target = normalizePath(href)
  return current === target || current.endsWith(target)
}
