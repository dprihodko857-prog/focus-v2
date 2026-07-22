export function createFocusAuthClient({
  apiBaseUrl = "/api",
  fetch: fetchImpl = globalThis.fetch?.bind(globalThis),
  location = globalThis.location,
} = {}) {
  const getSession = async () => {
    try {
      const response = await fetchImpl(apiUrl(apiBaseUrl, "/auth/session"), {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("Focus auth session load failed.");
      }

      return { status: "ok", ...await response.json() };
    } catch {
      return {
        status: "offline",
        configured: false,
        authenticated: false,
        accountId: null,
        user: null,
      };
    }
  };

  return {
    getSession,

    login(returnTo = "/") {
      const nextPath = normalizeReturnTo(returnTo, location);
      location.href = `${apiUrl(apiBaseUrl, "/auth/login")}?returnTo=${encodeURIComponent(nextPath)}`;
    },

    async logout() {
      try {
        const response = await fetchImpl(apiUrl(apiBaseUrl, "/auth/logout"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });

        if (!response.ok) {
          throw new Error("Focus auth logout failed.");
        }

        return { status: "ok", ...await response.json() };
      } catch {
        return { status: "offline", authenticated: false };
      }
    },
  };
}

function apiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function normalizeReturnTo(returnTo, locationRef) {
  try {
    const fallback = `${locationRef?.pathname || "/"}${locationRef?.search || ""}${locationRef?.hash || ""}` || "/";
    const url = new URL(returnTo || fallback, locationRef?.origin || "https://focus.local");
    return url.origin === (locationRef?.origin || "https://focus.local")
      ? `${url.pathname}${url.search}${url.hash}` || "/"
      : "/";
  } catch {
    return "/";
  }
}
