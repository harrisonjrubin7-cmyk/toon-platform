export type Role = "reader" | "editor" | "admin";
export type Actor = { id: string; role: Role; email: string; displayName: string; ageConfirmed: boolean };

const rank: Record<Role, number> = { reader: 0, editor: 1, admin: 2 };
export const hasRole = (actor: Pick<Actor, "role"> | null | undefined, min: Role) => !!actor && rank[actor.role] >= rank[min];

/** What each role may do. Server code checks these; the UI only hides what is not allowed. */
export const permissions = {
  readPublished: () => true,
  saveProgress: (a: Actor | null) => !!a,
  viewStudio: (a: Actor | null) => hasRole(a, "editor"),
  manageContent: (a: Actor | null) => hasRole(a, "editor"),
  manageUsers: (a: Actor | null) => hasRole(a, "admin"),
  viewActivity: (a: Actor | null) => hasRole(a, "admin"),
  // Card game: any signed-in adult account can play, collect and buy (all accounts confirm 18+ at signup).
  playGame: (a: Actor | null) => !!a && a.ageConfirmed,
  manageStore: (a: Actor | null) => hasRole(a, "admin"),
};
