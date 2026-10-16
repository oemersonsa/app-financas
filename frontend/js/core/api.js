// Transport does not own application state. Identity and redirects come from the caller.
export function createApi({ accountId, onAccountChanged, onUnauthorized, fetchImpl = globalThis.fetch }) {
  return async function request(url, options = {}) {
    const identity = accountId();
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(identity && url === "/api/state" ? { "X-Meu-Bolso-Account": identity } : {}),
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (response.status === 409 && (await response.clone().json()).code === "account_changed") {
      onAccountChanged();
      throw new Error("account changed");
    }
    if (response.status === 401) {
      onUnauthorized();
      throw new Error("session");
    }
    return response;
  };
}
