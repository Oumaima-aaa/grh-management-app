import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminUser,
  deleteUser,
  getAdminDashboard,
  getAdminLogs,
  updateAdminUser,
  updateAdminSettings,
  updateUserAccess,
  updateUserRole,
} from "../api";
import { AdminFlash, AdminPanel, DangerRowButton, EditRowButton, FormModalActions, Modal, useFlash } from "./components/ui";
import {
  CareersSection,
  DashboardSection,
  RecruitmentSection,
  EmployeesSection,
  EvaluationsSection,
  LeavesSection,
  NotificationsSection,
  ReportsSection,
  TrainingsSection,
} from "./sections";
import { UserPermissionsModal } from "./UserPermissionsModal";
import {
  ADMIN_NAV_PERMISSIONS,
  filterAdminNav,
  firstAllowedAdminSection,
  hasPermission,
} from "../permissions";

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊", group: "Principal" },
  { id: "employees", label: "Employes", icon: "👥", group: "RH (consultation)" },
  { id: "leaves", label: "Conges", icon: "📅", group: "RH (consultation)" },
  { id: "trainings", label: "Formations", icon: "🎓", group: "RH (consultation)" },
  { id: "evaluations", label: "Evaluations", icon: "⭐", group: "RH (consultation)" },
  { id: "careers", label: "Carrieres", icon: "📈", group: "RH (consultation)" },
  { id: "recruitment", label: "Recrutement", icon: "🎯", group: "RH (consultation)" },
  { id: "notifications", label: "Notifications", icon: "🔔", group: "Systeme" },
  { id: "reports", label: "Rapports", icon: "📑", group: "Administration" },
  { id: "users", label: "Utilisateurs", icon: "🔐", group: "Administration" },
  { id: "settings", label: "Parametres", icon: "⚙", group: "Administration" },
  { id: "logs", label: "Logs & activites", icon: "📋", group: "Administration" },
];

const LOG_ACTION_LABELS = {
  login: "Connexion",
  create_user: "Creation utilisateur",
  create_employee: "Creation employe",
  update_employee: "Mise a jour employe",
  delete_employee: "Suppression employe",
  change_role: "Changement de role",
  change_access: "Activation / desactivation",
  delete_user: "Suppression utilisateur",
  update_role_profile: "Profil de role",
  update_user_permissions: "Permissions utilisateur",
  update_settings: "Parametres systeme",
};

function pickSettings(settings) {
  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));
  return {
    security_mode: map.security_mode === "strict" ? "strict" : "standard",
    session_timeout_minutes: Number(map.session_timeout_minutes) || 120,
    company_name: map.company_name || "",
    company_email: map.company_email || "",
    company_phone: map.company_phone || "",
    company_address: map.company_address || "",
    email_notifications: map.email_notifications === "1",
    maintenance_mode: map.maintenance_mode === "1",
    timezone: map.timezone || "Africa/Casablanca",
    currency: map.currency || "MAD",
    annual_leave_days: Number(map.annual_leave_days) || 22,
    probation_months: Number(map.probation_months) || 6,
    workday_start: map.workday_start || "09:00",
    workday_end: map.workday_end || "18:00",
    manager_validation_required: map.manager_validation_required === "1",
    leave_alert_days: Number(map.leave_alert_days) || 3,
  };
}

const DEFAULT_SETTINGS = pickSettings([]);

function logActionLabel(action) {
  return LOG_ACTION_LABELS[action] || action;
}

export function AdminPage({ currentUser = null, currentUserEmail = "" }) {
  const [section, setSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { flash, setFlash, error, setError } = useFlash();

  const [dash, setDash] = useState(null);
  const [users, setUsers] = useState([]);
  const [settingsForm, setSettingsForm] = useState(pickSettings([]));
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "employe" });
  const [editUserId, setEditUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", password: "" });
  const [permUser, setPermUser] = useState(null);
  const [newUserPermissions, setNewUserPermissions] = useState([]);

  const loadDashboard = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await getAdminDashboard();
      setDash(data);
      setUsers(data.users || []);
      setSettingsForm(pickSettings(data.settings));
    } catch (e) {
      setError(e?.message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await getAdminLogs();
      setLogs(data.logs || []);
    } catch (e) {
      setError(e?.message || "Logs indisponibles");
    } finally {
      setLogsLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (section === "logs") loadLogs();
  }, [section, loadLogs]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = window.setTimeout(() => setFlash(""), 4000);
    return () => window.clearTimeout(t);
  }, [flash, setFlash]);

  const availableRoles = useMemo(() => ["admin", "rh", "employe"], []);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    const base = !q
      ? [...logs]
      : logs.filter((log) =>
          [log.actor_email, log.action, logActionLabel(log.action), log.target, JSON.stringify(log.meta || "")]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
    return base.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [logs, logSearch]);

  const visibleNav = useMemo(
    () => filterAdminNav(NAV, currentUser),
    [currentUser]
  );

  const navGroups = useMemo(() => {
    const g = {};
    visibleNav.forEach((item) => {
      if (!g[item.group]) g[item.group] = [];
      g[item.group].push(item);
    });
    return g;
  }, [visibleNav]);

  useEffect(() => {
    if (!currentUser) return;
    if (!visibleNav.some((n) => n.id === section)) {
      const first = firstAllowedAdminSection(NAV, currentUser);
      if (first) setSection(first);
    }
  }, [section, currentUser, visibleNav]);

  const currentNav = visibleNav.find((n) => n.id === section) || NAV.find((n) => n.id === section);

  const sectionAllowed = hasPermission(currentUser, ADMIN_NAV_PERMISSIONS[section]);

  return (
    <div className="admin-app">
      <button
        type="button"
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Menu"
      >
        ☰
      </button>

      <aside className={`admin-sidebar${sidebarOpen ? " admin-sidebar--open" : ""}`}>
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__logo">GRH</span>
          <div>
            <strong>Administration</strong>
            <span className="muted">Pilotage RH</span>
          </div>
        </div>
        <nav className="admin-sidebar__nav">
          {Object.entries(navGroups).map(([group, items]) => (
            <div key={group} className="admin-sidebar__group">
              <span className="admin-sidebar__group-label">{group}</span>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-sidebar__link${section === item.id ? " active" : ""}`}
                  onClick={() => {
                    setSection(item.id);
                    setSidebarOpen(false);
                  }}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {sidebarOpen ? (
        <button type="button" className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fermer" />
      ) : null}

      <div className="admin-main">
        <header className={`admin-topbar${section === "dashboard" ? " admin-topbar--dash" : ""}`}>
          {section !== "dashboard" ? (
            <div>
              <p className="admin-topbar__eyebrow">Espace administrateur</p>
              <h2>{currentNav?.label || "Administration"}</h2>
            </div>
          ) : (
            <div className="admin-topbar__spacer" aria-hidden />
          )}
          <button type="button" className="btn-ghost-sm" onClick={loadDashboard} disabled={loading}>
            ↻ Actualiser
          </button>
        </header>

        <AdminFlash flash={flash} error={error} />

        {loading && section === "dashboard" ? (
          <p className="muted admin-loading">Chargement des indicateurs…</p>
        ) : null}

        {section === "dashboard" && sectionAllowed && dash ? (
          <DashboardSection
            stats={dash.stats}
            charts={dash.charts}
            recent={dash.recent}
            onNavigate={setSection}
          />
        ) : null}

        {section === "employees" && sectionAllowed ? (
          <EmployeesSection
            departments={dash?.departments}
            positions={dash?.positions}
            onRefresh={loadDashboard}
            setFlash={setFlash}
            setError={setError}
          />
        ) : null}

        {section === "leaves" && sectionAllowed ? <LeavesSection setFlash={setFlash} setError={setError} /> : null}
        {section === "trainings" && sectionAllowed ? <TrainingsSection setFlash={setFlash} setError={setError} /> : null}
        {section === "evaluations" && sectionAllowed ? <EvaluationsSection setFlash={setFlash} setError={setError} /> : null}
        {section === "careers" && sectionAllowed ? <CareersSection setFlash={setFlash} setError={setError} /> : null}
        {section === "recruitment" && sectionAllowed ? <RecruitmentSection setError={setError} /> : null}
        {section === "reports" && sectionAllowed ? <ReportsSection setError={setError} /> : null}
        {section === "notifications" && sectionAllowed ? <NotificationsSection setError={setError} /> : null}

        {section === "users" && sectionAllowed ? (
          <>
          <AdminPanel title="Utilisateurs systeme" desc="Comptes admin, RH et employes">
            <form
              className="admin-form-inline"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await createAdminUser({
                    name: newUser.name.trim(),
                    email: newUser.email.trim().toLowerCase(),
                    password: newUser.password,
                    role: newUser.role,
                    ...(newUserPermissions.length ? { permissions: newUserPermissions } : {}),
                  });
                  setNewUser({ name: "", email: "", password: "", role: "employe" });
                  setNewUserPermissions([]);
                  setFlash("Utilisateur cree.");
                  loadDashboard();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              <input placeholder="Nom" value={newUser.name} onChange={(e) => setNewUser((s) => ({ ...s, name: e.target.value }))} required />
              <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))} required />
              <input type="password" placeholder="Mot de passe" value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} required minLength={8} />
              <select value={newUser.role} onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value }))}>
                <option value="employe">Employe</option>
                <option value="rh">RH</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="btn-primary-solid">Ajouter</button>
            </form>
            {newUser.role !== "employe" ? (
              <p className="muted admin-perm-hint">
                Permissions propres a ce compte (obligatoire pour l acces aux menus) :{" "}
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() =>
                    setPermUser({
                      id: "__new__",
                      name: newUser.name || "Nouvel utilisateur",
                      email: newUser.email,
                      role: newUser.role,
                      _draft: true,
                    })
                  }
                >
                  Assigner les modules
                </button>
                {newUserPermissions.length
                  ? ` · ${newUserPermissions.length} module(s) pour ce compte uniquement`
                  : " · aucune permission tant que vous n assignez pas de modules"}
              </p>
            ) : null}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actif</th>
                    <th>Permissions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = currentUserEmail && u.email?.toLowerCase() === currentUserEmail.toLowerCase();
                    return (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <div className="user-role-cell">
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                try {
                                  await updateUserRole(u.id, e.target.value);
                                  setFlash("Role mis a jour.");
                                  loadDashboard();
                                } catch (err) {
                                  setError(err.message);
                                }
                              }}
                            >
                              {availableRoles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <label>
                            <input
                              type="checkbox"
                              checked={u.active !== false}
                              disabled={isSelf}
                              onChange={async (e) => {
                                try {
                                  await updateUserAccess(u.id, e.target.checked);
                                  setFlash("Acces mis a jour.");
                                  loadDashboard();
                                } catch (err) {
                                  setError(err.message);
                                }
                              }}
                            />{" "}
                            actif
                          </label>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => setPermUser(u)}
                          >
                            {u.role === "employe" ? "Modules visibles" : "Permissions"}
                          </button>
                          {(u.permissions || []).length ? (
                            <span className="muted admin-perm-count">
                              {(u.permissions || []).length} module(s) pour ce compte
                            </span>
                          ) : (
                            <span className="muted admin-perm-count">Aucun module assigne</span>
                          )}
                        </td>
                        <td>
                          <EditRowButton
                            onClick={() => {
                              setEditUserId(u.id);
                              setEditUserForm({ name: u.name || "", email: u.email || "", password: "" });
                            }}
                          />
                          <DangerRowButton
                            disabled={isSelf}
                            onClick={async () => {
                              if (!window.confirm(`Supprimer ${u.email} ?`)) return;
                              try {
                                await deleteUser(u.id);
                                setFlash("Supprime.");
                                loadDashboard();
                              } catch (err) {
                                setError(err.message);
                              }
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminPanel>

          <Modal
            open={Boolean(editUserId)}
            title={
              editUserId
                ? `Compte utilisateur — ${users.find((u) => u.id === editUserId)?.name || ""}`
                : "Compte utilisateur"
            }
            onClose={() => {
              setEditUserId(null);
              setEditUserForm({ name: "", email: "", password: "" });
            }}
          >
            <form
              className="admin-form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updateAdminUser(editUserId, {
                    name: editUserForm.name.trim(),
                    email: editUserForm.email.trim().toLowerCase(),
                    ...(editUserForm.password ? { password: editUserForm.password } : {}),
                  });
                  setFlash("Utilisateur mis a jour.");
                  setEditUserId(null);
                  setEditUserForm({ name: "", email: "", password: "" });
                  loadDashboard();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              <label>
                Nom
                <input
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm((s) => ({ ...s, email: e.target.value }))}
                  required
                />
              </label>
              <label>
                Nouveau mot de passe (optionnel)
                <input
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm((s) => ({ ...s, password: e.target.value }))}
                  minLength={8}
                />
              </label>
              <FormModalActions
                onCancel={() => {
                  setEditUserId(null);
                  setEditUserForm({ name: "", email: "", password: "" });
                }}
                secondary={
                  users.find((u) => u.id === editUserId)?.role === "employe" ? (
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => {
                        const u = users.find((x) => x.id === editUserId);
                        if (u) setPermUser(u);
                      }}
                    >
                      Modules visibles
                    </button>
                  ) : users.find((u) => u.id === editUserId) ? (
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => {
                        const u = users.find((x) => x.id === editUserId);
                        if (u) setPermUser(u);
                      }}
                    >
                      Permissions
                    </button>
                  ) : null
                }
                submitLabel="Enregistrer"
              />
            </form>
          </Modal>
          </>
        ) : null}

        {section === "settings" && sectionAllowed ? (
          <AdminPanel title="Parametres" desc="Configuration entreprise, RH et securite">
            <div className="admin-meta-chips">
              <span className="admin-chip-meta">Session: {settingsForm.session_timeout_minutes} min</span>
              <span className="admin-chip-meta">Conge annuel: {settingsForm.annual_leave_days} jours</span>
              <span className="admin-chip-meta">Fuseau: {settingsForm.timezone}</span>
              <span className="admin-chip-meta">Devise: {settingsForm.currency}</span>
            </div>
            <form
              className="admin-settings-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updateAdminSettings(settingsForm);
                  setFlash("Parametres enregistres.");
                  loadDashboard();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              <fieldset>
                <legend>Identite entreprise</legend>
                <label>Nom<input value={settingsForm.company_name} onChange={(e) => setSettingsForm((s) => ({ ...s, company_name: e.target.value }))} /></label>
                <label>Email<input type="email" value={settingsForm.company_email} onChange={(e) => setSettingsForm((s) => ({ ...s, company_email: e.target.value }))} /></label>
                <label>Telephone<input value={settingsForm.company_phone} onChange={(e) => setSettingsForm((s) => ({ ...s, company_phone: e.target.value }))} /></label>
                <label className="admin-form-span2">Adresse<textarea rows={2} value={settingsForm.company_address} onChange={(e) => setSettingsForm((s) => ({ ...s, company_address: e.target.value }))} /></label>
                <label>Fuseau horaire
                  <input value={settingsForm.timezone} onChange={(e) => setSettingsForm((s) => ({ ...s, timezone: e.target.value }))} placeholder="Africa/Casablanca" />
                </label>
                <label>Devise
                  <input value={settingsForm.currency} onChange={(e) => setSettingsForm((s) => ({ ...s, currency: e.target.value.toUpperCase() }))} maxLength={10} />
                </label>
              </fieldset>
              <fieldset>
                <legend>Politique RH</legend>
                <label>Conge annuel (jours)
                  <input type="number" min={0} max={60} value={settingsForm.annual_leave_days} onChange={(e) => setSettingsForm((s) => ({ ...s, annual_leave_days: Number(e.target.value) }))} />
                </label>
                <label>Periode d essai (mois)
                  <input type="number" min={0} max={24} value={settingsForm.probation_months} onChange={(e) => setSettingsForm((s) => ({ ...s, probation_months: Number(e.target.value) }))} />
                </label>
                <label>Heure debut
                  <input type="time" value={settingsForm.workday_start} onChange={(e) => setSettingsForm((s) => ({ ...s, workday_start: e.target.value }))} />
                </label>
                <label>Heure fin
                  <input type="time" value={settingsForm.workday_end} onChange={(e) => setSettingsForm((s) => ({ ...s, workday_end: e.target.value }))} />
                </label>
                <label>Alerte conge (jours avant debut)
                  <input type="number" min={0} max={30} value={settingsForm.leave_alert_days} onChange={(e) => setSettingsForm((s) => ({ ...s, leave_alert_days: Number(e.target.value) }))} />
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={settingsForm.manager_validation_required} onChange={(e) => setSettingsForm((s) => ({ ...s, manager_validation_required: e.target.checked }))} />
                  Validation manager avant RH
                </label>
              </fieldset>
              <fieldset>
                <legend>Securite & systeme</legend>
                <label>
                  Mode
                  <select value={settingsForm.security_mode} onChange={(e) => setSettingsForm((s) => ({ ...s, security_mode: e.target.value }))}>
                    <option value="standard">Standard</option>
                    <option value="strict">Strict</option>
                  </select>
                </label>
                <label>
                  Session (min)
                  <input type="number" min={30} max={1440} value={settingsForm.session_timeout_minutes} onChange={(e) => setSettingsForm((s) => ({ ...s, session_timeout_minutes: Number(e.target.value) }))} />
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={settingsForm.email_notifications} onChange={(e) => setSettingsForm((s) => ({ ...s, email_notifications: e.target.checked }))} />
                  Notifications email
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={settingsForm.maintenance_mode} onChange={(e) => setSettingsForm((s) => ({ ...s, maintenance_mode: e.target.checked }))} />
                  Mode maintenance
                </label>
              </fieldset>
              <div className="admin-form-actions admin-form-span2">
                <button type="button" className="btn-ghost-sm" onClick={() => setSettingsForm(DEFAULT_SETTINGS)}>Reinitialiser</button>
                <button type="submit" className="btn-primary-solid">Enregistrer</button>
              </div>
            </form>
          </AdminPanel>
        ) : null}

        {section === "logs" && sectionAllowed ? (
          <AdminPanel title="Logs & activites" desc="Connexions, actions admin et audit">
            <div className="admin-toolbar">
              <input
                className="admin-search"
                type="search"
                placeholder="Filtrer les logs…"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
              <button type="button" className="btn-ghost-sm" onClick={loadLogs} disabled={logsLoading}>
                Rafraichir
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Acteur</th>
                    <th>Cible</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id ?? `${log.created_at}-${log.action}`}>
                      <td>{log.created_at ? new Date(log.created_at).toLocaleString("fr-FR") : "—"}</td>
                      <td>
                        <span className="admin-pill pill--neutral">{logActionLabel(log.action)}</span>
                      </td>
                      <td>{log.actor_email || "—"}</td>
                      <td>{log.target || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        ) : null}
      </div>

      <UserPermissionsModal
        user={permUser?._draft ? { ...permUser, permissions: newUserPermissions } : permUser}
        open={Boolean(permUser)}
        draft={Boolean(permUser?._draft)}
        onClose={() => setPermUser(null)}
        onSaved={(perms) => {
          if (permUser?._draft) {
            setNewUserPermissions(perms);
          } else {
            loadDashboard();
          }
        }}
        setFlash={setFlash}
        setError={setError}
      />
    </div>
  );
}
