// Tiny history helper shared by App and the landing module.
export function pushRoute(to: string) {
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
