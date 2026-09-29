import api from "../data/api";
import { useOptionalAuth } from "../auth/AuthContext";

import { Avatar } from "./dashboard/ui";

/** Signed-in user's photo (or initial) in the editor's top-right bar */
export function EditorUserAvatar() {
  const user = useOptionalAuth()?.user;
  if (!user) {
    return null;
  }
  return (
    <Avatar
      name={user.name || user.email}
      size="app-profile-avatar text-sm"
      src={api.avatarUrl(user.id, user.avatar_version)}
    />
  );
}
