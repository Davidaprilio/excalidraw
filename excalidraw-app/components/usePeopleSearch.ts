import { useEffect, useState } from "react";

import type { InvitePerson } from "../data/api";

const SEARCH_DELAY_MS = 200;

/** Debounced people search (2+ characters) for invite pickers */
export function usePeopleSearch(
  query: string,
  search: (q: string) => Promise<{ users: InvitePerson[] }>,
  enabled = true,
) {
  const [users, setUsers] = useState<InvitePerson[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      search(q)
        .then((res) => !cancelled && setUsers(res.users))
        .catch(() => !cancelled && setUsers([]));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `search` is recreated by callers on each render; the query is the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabled]);

  return users;
}
