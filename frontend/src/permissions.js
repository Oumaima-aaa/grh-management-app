/**
 * Permissions strictement par utilisateur (table user_permissions).
 * Le role (admin/rh/employe) ne determine pas les menus — seules les cases assignees au compte comptent.
 */
/** Catalogue des permissions (aligne sur le backend). */
export const PERMISSION_LABELS = {
  manage_users: "Gestion des utilisateurs",
  manage_employees: "Gestion des employes",
  manage_hr_info: "Demandes infos RH (employes)",
  manage_leave: "Gestion des conges",
  manage_training: "Gestion des formations",
  manage_evaluations: "Gestion des evaluations",
  manage_recruitment: "Gestion du recrutement",
  manage_careers: "Gestion des carrieres",
  view_reports: "Gestion des rapports",
  view_dashboard: "Tableau de bord",
  view_own_profile: "Mon profil uniquement",
  view_own_leaves: "Mes conges",
  view_own_trainings: "Mes formations",
  view_own_evaluations: "Mes evaluations",
  view_own_career: "Ma carriere",
  view_own_hr_info: "Mes infos RH",
};

/** Presets rapides (assignation par compte). */
export const PERMISSION_PRESETS = {
  employe_profil_seul: {
    label: "Employe — profil uniquement",
    slugs: ["view_own_profile"],
  },
  employe_standard: {
    label: "Employe — profil + conges + formations",
    slugs: ["view_own_profile", "view_own_leaves", "view_own_trainings"],
  },
  employe_complet: {
    label: "Employe — tous les modules personnels",
    slugs: [
      "view_own_profile",
      "view_own_leaves",
      "view_own_trainings",
      "view_own_evaluations",
      "view_own_career",
      "view_own_hr_info",
    ],
  },
};

export const ALL_PERMISSION_SLUGS = Object.keys(PERMISSION_LABELS);

export const ROLE_PERMISSION_SLUGS = {
  admin: ["manage_users", "view_dashboard", "view_reports"],
  rh: [
    "manage_employees",
    "manage_hr_info",
    "manage_leave",
    "manage_training",
    "manage_evaluations",
    "manage_recruitment",
    "manage_careers",
    "view_dashboard",
  ],
  employe: [
    "view_own_profile",
    "view_own_leaves",
    "view_own_trainings",
    "view_own_evaluations",
    "view_own_career",
    "view_own_hr_info",
  ],
};

export function permissionsForRole(role) {
  if (role === "employe") {
    return ROLE_PERMISSION_SLUGS.employe;
  }
  if (role === "rh") {
    return ROLE_PERMISSION_SLUGS.rh;
  }
  if (role === "admin") {
    return ALL_PERMISSION_SLUGS;
  }
  return ALL_PERMISSION_SLUGS;
}

/** Navigation admin : section -> permission requise */
export const ADMIN_NAV_PERMISSIONS = {
  dashboard: "view_dashboard",
  employees: "manage_employees",
  leaves: "manage_leave",
  trainings: "manage_training",
  evaluations: "manage_evaluations",
  careers: "manage_careers",
  recruitment: "manage_recruitment",
  reports: "manage_users",
  notifications: "view_dashboard",
  users: "manage_users",
  settings: "manage_users",
  logs: "manage_users",
};

/** Onglets RH : id -> permission */
export const HR_TAB_PERMISSIONS = {
  conges: "manage_leave",
  recruitment: "manage_recruitment",
  evaluations: "manage_evaluations",
  trainings: "manage_training",
  careers: "manage_careers",
  employes: "manage_employees",
  infosrh: ["manage_hr_info", "manage_employees"],
};

export const EMPLOYEE_TAB_PERMISSIONS = {
  profil: "view_own_profile",
  conges: "view_own_leaves",
  formations: "view_own_trainings",
  evaluations: "view_own_evaluations",
  carriere: "view_own_career",
  infos: "view_own_hr_info",
};

export const EMPLOYEE_TAB_ORDER = [
  "profil",
  "conges",
  "formations",
  "evaluations",
  "carriere",
  "infos",
];

const STORAGE_KEY = "grh_permissions";

export function persistPermissions(permissions) {
  const list = Array.isArray(permissions) ? permissions : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function readStoredPermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearStoredPermissions() {
  localStorage.removeItem(STORAGE_KEY);
}

export function normalizeUserFromAuth(payload) {
  const user = payload?.user || payload || {};
  const permissions =
    user.permissions ||
    payload?.permissions ||
    readStoredPermissions() ||
    [];
  const normalized = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: [...new Set(permissions)],
  };
  persistPermissions(normalized.permissions);
  return normalized;
}

export function hasPermission(user, slug) {
  if (!slug) return true;
  const list = user?.permissions || readStoredPermissions();
  return list.includes(slug);
}

export function hasAnyPermission(user, slugs) {
  if (!slugs?.length) return true;
  return slugs.some((s) => hasPermission(user, s));
}

export function filterAdminNav(navItems, user) {
  return navItems.filter((item) => hasPermission(user, ADMIN_NAV_PERMISSIONS[item.id]));
}

export function hrTabAllowed(user, tabId) {
  const perm = HR_TAB_PERMISSIONS[tabId];
  if (!perm) return true;
  if (Array.isArray(perm)) return hasAnyPermission(user, perm);
  return hasPermission(user, perm);
}

export function filterHrTabs(tabIds, user) {
  return tabIds.filter((id) => hrTabAllowed(user, id));
}

export function filterEmployeeTabs(tabIds, user) {
  return tabIds.filter((id) => hasPermission(user, EMPLOYEE_TAB_PERMISSIONS[id]));
}

export function firstAllowedEmployeeTab(tabOrder, user) {
  const allowed = filterEmployeeTabs(tabOrder, user);
  return allowed[0] || "profil";
}

export function firstAllowedAdminSection(navItems, user) {
  const allowed = filterAdminNav(navItems, user);
  return allowed[0]?.id || null;
}

export function firstAllowedHrTab(tabOrder, user) {
  const allowed = filterHrTabs(tabOrder, user);
  return allowed[0] || "conges";
}

export function labelForPermission(slug) {
  return PERMISSION_LABELS[slug] || slug;
}
