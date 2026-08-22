import { useEffect, useState } from "react";

export type Route =
  | { page: "gallery"; focusId: string | null }
  | { page: "devices" };

export function parseHash(raw: string): Route {
  const h = raw.replace(/^#/, "");
  const [path, query = ""] = h.split("?");
  const params = new URLSearchParams(query);
  if (path.startsWith("/devices")) return { page: "devices" };
  return { page: "gallery", focusId: params.get("focus") };
}

export function navigate(to: string) {
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
