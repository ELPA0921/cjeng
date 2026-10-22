import { useEffect, useSyncExternalStore } from 'react'
import { navigationHash, parseNavigationHash, type NavigationRoute } from './navigation'

type Entry = { session: string; index: number; route: string }
const eventName = 'cjeng-navigation'
const entry = (): Entry | undefined => window.history.state?.cjengNavigation
const maxIndex = (item: Entry) => Number(sessionStorage.getItem(`cjeng-navigation-${item.session}`) ?? item.index)
const snapshot = () => {
  const item = entry()
  return item ? `${item.index}/${maxIndex(item)}` : '0/0'
}
const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify)
  window.addEventListener(eventName, notify)
  return () => {
    window.removeEventListener('popstate', notify)
    window.removeEventListener(eventName, notify)
  }
}

export function useBrowserNavigation(route: NavigationRoute, restore: (route: NavigationRoute) => void) {
  const position = useSyncExternalStore(subscribe, snapshot)
  const hash = navigationHash(route)
  useEffect(() => {
    const previous = entry()
    if (previous?.route === hash) return
    const next: Entry = previous
      ? { ...previous, index: previous.index + 1, route: hash }
      : { session: crypto.randomUUID(), index: 0, route: hash }
    const url = new URL(window.location.href)
    url.hash = hash
    const state = { ...window.history.state, cjengNavigation: next }
    if (previous) window.history.pushState(state, '', url)
    else window.history.replaceState(state, '', url)
    sessionStorage.setItem(`cjeng-navigation-${next.session}`, String(next.index))
    window.dispatchEvent(new Event(eventName))
  }, [hash])

  useEffect(() => {
    const onPopState = () => {
      const target = parseNavigationHash(window.location.hash)
      if (target) restore(target)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [restore])

  const [index, max] = position.split('/').map(Number)
  return { canGoBack: index > 0, canGoForward: index < max }
}
