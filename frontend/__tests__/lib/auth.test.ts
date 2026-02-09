import { getUserRole, hasRole, type UserRole } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

function makeUser(role?: string): User {
  return {
    id: "user-123",
    aud: "authenticated",
    created_at: "2025-01-01",
    app_metadata: role ? { role } : {},
    user_metadata: {},
  } as User;
}

describe("getUserRole", () => {
  it("returns 'viewer' for null user", () => {
    expect(getUserRole(null)).toBe("viewer");
  });

  it("returns 'recruiter' as default when no role metadata", () => {
    const user = makeUser();
    expect(getUserRole(user)).toBe("recruiter");
  });

  it("returns the role from app_metadata", () => {
    expect(getUserRole(makeUser("admin"))).toBe("admin");
    expect(getUserRole(makeUser("hiring_manager"))).toBe("hiring_manager");
    expect(getUserRole(makeUser("interviewer"))).toBe("interviewer");
  });
});

describe("hasRole", () => {
  it("returns false for null user", () => {
    expect(hasRole(null, ["admin"])).toBe(false);
  });

  it("returns true when user has a required role", () => {
    const user = makeUser("admin");
    expect(hasRole(user, ["admin", "recruiter"])).toBe(true);
  });

  it("returns false when user does not have a required role", () => {
    const user = makeUser("interviewer");
    expect(hasRole(user, ["admin"])).toBe(false);
  });

  it("viewer (null user) matches viewer role", () => {
    expect(hasRole(null, ["viewer"])).toBe(true);
  });

  it("default recruiter role matches recruiter requirement", () => {
    const user = makeUser();
    expect(hasRole(user, ["recruiter", "admin"])).toBe(true);
  });
});
