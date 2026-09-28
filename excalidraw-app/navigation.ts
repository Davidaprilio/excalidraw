/** Client-side navigation for the self-hosted routes (see SelfHostedRouting in App.tsx). */
export function navigateTo(path: string, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState({}, "", path);
  } else {
    window.history.pushState({}, "", path);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}
