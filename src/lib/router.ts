import { useEffect, useState } from "react";

export type Route =
  | { page: "main"; focusId: string | null }
  | { page: "datacenter" };

export function parseHash(raw: string): Route {
  const h = raw.replace(/^#/, "");
  const [path, query = ""] = h.split("?");
  const params = new URLSearchParams(query);
  if (path.startsWith("/datacenter")) return { page: "datacenter" };
  return { page: "main", focusId: params.get("focus") };
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
