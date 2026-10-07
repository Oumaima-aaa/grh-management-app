import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminEmployee,
  createHrTraining,
  deleteAdminEmployee,
  deleteHrTraining,
  getAdminNotifications,
  getAdminReport,
  getHrCareers,
  getHrEmployees,
  getHrEvaluations,
  getHrLeaveRequests,
  getHrRecruitment,
  getHrTrainings,
  patchHrLeaveRequest,
  updateAdminEmployee,
} from "../api";
import {
  AdminPanel,
  BarChart,
  DataTable,
  DangerRowButton,
  EditRowButton,
  FormModalActions,
  Modal,
  Pagination,
  ReadOnlyBanner,
  SearchInput,
  StatCard,
  StatusPill,
  downloadCsv,
  fmtDate,
  fmtDateTime,
  usePagedFilter,
} from "./components/ui";

const TRAINING_STATUS = { PLANIFIE: "Planifie", EN_COURS: "En cours", TERMINE: "Termine" };

const LEAVE_STATUS_CHART = {
  EN_ATTENTE: "En attente",
  VALIDE: "Valide",
  REFUSE: "Refuse",
};

const ACTIVITY_META = {
  login: { label: "Connexion", icon: "🔑", tone: "blue" },
  create_user: { label: "Utilisateur cree", icon: "👤", tone: "violet" },
  create_employee: { label: "Employe cree", icon: "➕", tone: "emerald" },
  update_employee: { label: "Employe modifie", icon: "✏", tone: "amber" },
  delete_employee: { label: "Employe supprime", icon: "🗑", tone: "rose" },
  change_role: { label: "Role modifie", icon: "🛡", tone: "violet" },
  change_access: { label: "Acces modifie", icon: "🔐", tone: "amber" },
  delete_user: { label: "Utilisateur supprime", icon: "✕", tone: "rose" },
  update_settings: { label: "Parametres", icon: "⚙", tone: "slate" },
  update_user_permissions: { label: "Permissions", icon: "📋", tone: "blue" },
  hr_info_request: { label: "Demande infos RH", icon: "💬", tone: "amber" },
};

function activityMeta(action) {
  return ACTIVITY_META[action] || { label: action, icon: "•", tone: "slate" };
}

const DASH_QUICK_LINKS = [
  { id: "leaves", label: "Conges", icon: "📅" },
  { id: "employees", label: "Employes", icon: "👥" },
  { id: "users", label: "Utilisateurs", icon: "🔐" },
  { id: "reports", label: "Rapports", icon: "📑" },
  { id: "logs", label: "Journal", icon: "📋" },
];

const INFO_STATUS_DASH = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TRAITEE: "Traitee",
  FERMEE: "Fermee",
};

export function DashboardSection({ stats, charts, recent, onNavigate }) {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const pending = stats?.pending_leaves ?? 0;
  const infoPending = stats?.info_requests_pending ?? 0;
  const leaves = recent?.leaves || [];
  const infoRequests = recent?.info_requests || [];

  return (
    <div className="admin-dashboard">
      <header className="admin-dash-hero card">
        <div className="admin-dash-hero__main">
          <p className="admin-dash-hero__eyebrow">Pilotage RH</p>
          <h2 className="admin-dash-hero__title">Tableau de bord</h2>
          <p className="admin-dash-hero__lede muted">
            Vue synthetique de l activite : effectifs, conges, formations et suivi systeme.
          </p>
        </div>
        <div className="admin-dash-hero__aside">
          <time className="admin-dash-hero__date" dateTime={new Date().toISOString().slice(0, 10)}>
            {today}
          </time>
          <div className="admin-dash-hero__badges">
            <span className="admin-dash-badge admin-dash-badge--amber">
              <strong>{pending}</strong> conge{pending !== 1 ? "s" : ""} en attente
            </span>
            <span className="admin-dash-badge admin-dash-badge--blue">
              <strong>{stats?.users_count ?? 0}</strong> comptes
            </span>
            {infoPending > 0 ? (
              <span className="admin-dash-badge admin-dash-badge--rose">
                <strong>{infoPending}</strong> infos RH
              </span>
            ) : null}
          </div>
        </div>
        <nav className="admin-dash-quick" aria-label="Acces rapides">
          {DASH_QUICK_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className="admin-dash-quick__btn"
              onClick={() => onNavigate(link.id)}
            >
              <span className="admin-dash-quick__icon" aria-hidden>
                {link.icon}
              </span>
              {link.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="admin-dash-kpis">
        <StatCard
          tone="blue"
          icon="👥"
          label="Employes"
          value={stats?.employees_count ?? 0}
          hint="Comptes collaborateur"
          onClick={() => onNavigate("employees")}
        />
        <StatCard
          tone="amber"
          icon="📅"
          label="Conges en attente"
          value={pending}
          hint="A valider par le RH"
          onClick={() => onNavigate("leaves")}
        />
        <StatCard
          tone="violet"
          icon="🎓"
          label="Formations actives"
          value={stats?.active_trainings ?? 0}
          hint="Planifiees ou en cours"
          onClick={() => onNavigate("trainings")}
        />
        <StatCard
          tone="emerald"
          icon="⭐"
          label="Evaluations"
          value={stats?.evaluations_count ?? 0}
          hint="Total enregistre"
          onClick={() => onNavigate("evaluations")}
        />
        <StatCard
          tone="slate"
          icon="📈"
          label="Plans de carriere"
          value={stats?.career_plans_count ?? 0}
          hint="Statut actif"
          onClick={() => onNavigate("careers")}
        />
        <StatCard
          tone="amber"
          icon="💬"
          label="Infos RH employes"
          value={infoPending}
          hint="Demandes en attente"
          onClick={() => onNavigate("employees")}
        />
      </div>

      <div className="admin-dash-layout">
        <div className="admin-dash-layout__primary">
          <section className="admin-dash-card card">
            <div className="admin-dash-card__head">
              <div>
                <h3>Conges par statut</h3>
                <p className="muted">Repartition des demandes</p>
              </div>
            </div>
            <BarChart
              variant="dash"
              items={charts?.leaves_by_status || []}
              labelKey="label"
              valueKey="total"
              formatLabel={(v) => LEAVE_STATUS_CHART[v] || v}
            />
          </section>

          <section className="admin-dash-card card">
            <div className="admin-dash-card__head">
              <div>
                <h3>Effectifs par service</h3>
                <p className="muted">Repartition des employes</p>
              </div>
            </div>
            <BarChart variant="dash" items={charts?.employees_by_service || []} />
          </section>
        </div>

        <aside className="admin-dash-card card admin-dash-card--activity">
          <div className="admin-dash-card__head">
            <div>
              <h3>Activite recente</h3>
              <p className="muted">Journal systeme</p>
            </div>
            <button type="button" className="btn-ghost-sm" onClick={() => onNavigate("logs")}>
              Tout voir
            </button>
          </div>
          <ul className="admin-dash-feed">
            {(recent?.activities || []).slice(0, 8).map((a) => {
              const meta = activityMeta(a.action);
              return (
                <li key={a.id} className={`admin-dash-feed__item admin-dash-feed__item--${meta.tone}`}>
                  <span className="admin-dash-feed__icon" aria-hidden>
                    {meta.icon}
                  </span>
                  <div className="admin-dash-feed__body">
                    <strong>{meta.label}</strong>
                    <span className="muted">{a.actor_email || "systeme"}</span>
                  </div>
                  <time className="admin-dash-feed__time">{fmtDateTime(a.created_at)}</time>
                </li>
              );
            })}
            {(recent?.activities || []).length === 0 ? (
              <li className="admin-dash-empty muted">Aucune activite recente.</li>
            ) : null}
          </ul>
        </aside>
      </div>

      {infoRequests.length > 0 ? (
        <section className="admin-dash-card card">
          <div className="admin-dash-card__head">
            <div>
              <h3>Infos RH — messages employes</h3>
              <p className="muted">Demandes envoyees vers le service RH</p>
            </div>
          </div>
          <ul className="admin-dash-info-list">
            {infoRequests.map((r) => (
              <li key={r.id} className="admin-dash-info-item">
                <div className="admin-dash-leave__avatar" aria-hidden>
                  {(r.employee_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="admin-dash-leave__main">
                  <strong>{r.subject}</strong>
                  <span className="muted">
                    {r.employee_name} · {INFO_STATUS_DASH[r.status] || r.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="admin-dash-card card">
        <div className="admin-dash-card__head">
          <div>
            <h3>Dernieres demandes de conge</h3>
            <p className="muted">Les six plus recentes</p>
          </div>
          <button type="button" className="btn-secondary-sm" onClick={() => onNavigate("leaves")}>
            Gerer les conges
          </button>
        </div>
        {leaves.length === 0 ? (
          <p className="admin-dash-empty muted">Aucune demande pour le moment.</p>
        ) : (
          <ul className="admin-dash-leaves">
            {leaves.map((r) => (
              <li key={r.id} className="admin-dash-leave">
                <div className="admin-dash-leave__avatar" aria-hidden>
                  {(r.employee_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="admin-dash-leave__main">
                  <strong>{r.employee_name || r.employee_email}</strong>
                  <span className="muted">
                    {r.leave_type} · {fmtDate(r.from)} → {fmtDate(r.to)}
                  </span>
                </div>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function EmployeesSection({ departments, positions, onRefresh, setFlash, setError, readOnly = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    matricule: "",
    poste: "",
    service: "",
    salaire: "",
    hire_date: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHrEmployees();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    load();
  }, [load]);

  const pager = usePagedFilter(items, {
    searchKeys: ["name", "email", "matricule", "poste", "service"],
    pageSize: 10,
  });

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (modal === "create") {
        await createAdminEmployee({
          ...form,
          salaire: form.salaire ? Number(form.salaire) : null,
        });
        setFlash("Employe cree.");
      } else if (detail) {
        await updateAdminEmployee(detail.id, {
          name: form.name,
          matricule: form.matricule,
          poste: form.poste,
          service: form.service,
          salaire: form.salaire ? Number(form.salaire) : null,
          hire_date: form.hire_date || null,
          active: form.active !== false,
        });
        setFlash("Employe mis a jour.");
      }
      setModal(null);
      setDetail(null);
      load();
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEdit(emp) {
    setDetail(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      password: "",
      matricule: emp.matricule || "",
      poste: emp.poste || "",
      service: emp.service || "",
      salaire: emp.salaire ?? "",
      hire_date: emp.hire_date ? String(emp.hire_date).slice(0, 10) : "",
      active: emp.active !== false,
    });
    setModal("edit");
  }

  const columns = [
    { key: "matricule", label: "Matricule" },
    { key: "name", label: "Nom" },
    { key: "email", label: "Email" },
    { key: "poste", label: "Poste" },
    { key: "service", label: "Service" },
    { key: "hire_date", label: "Embauche", render: (r) => fmtDate(r.hire_date) },
  ];
  if (!readOnly) {
    columns.push({
      label: "",
      render: (r) => (
        <div className="admin-row-actions">
          <EditRowButton onClick={() => openEdit(r)} />
          <DangerRowButton
            onClick={async () => {
              if (!window.confirm(`Supprimer ${r.email} ?`)) return;
              try {
                await deleteAdminEmployee(r.id);
                setFlash("Employe supprime.");
                load();
                onRefresh?.();
              } catch (err) {
                setError(err.message);
              }
            }}
          />
        </div>
      ),
    });
  }

  return (
    <>
      {readOnly ? <ReadOnlyBanner /> : null}
      <AdminPanel
        title={readOnly ? "Employes (consultation)" : "Gestion des employes"}
        desc={readOnly ? "Vue lecture seule des fiches employes" : "Fiches EMPLOYE, services et postes"}
        actions={
          readOnly ? null : (
            <button type="button" className="btn-primary-solid" onClick={() => { setModal("create"); setDetail(null); setForm({ name: "", email: "", password: "", matricule: "", poste: "", service: "", salaire: "", hire_date: "" }); }}>
              + Nouvel employe
            </button>
          )
        }
      >
        <div className="admin-toolbar">
          <SearchInput value={pager.q} onChange={(v) => { pager.setQ(v); pager.setPage(1); }} placeholder="Nom, email, matricule, service…" />
          <button type="button" className="btn-ghost-sm" onClick={load} disabled={loading}>Actualiser</button>
        </div>
        <div className="admin-meta-chips">
          <span className="admin-chip-meta">{departments?.length || 0} services</span>
          <span className="admin-chip-meta">{positions?.length || 0} postes</span>
        </div>
        <DataTable columns={columns} rows={pager.slice} />
        <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} />
      </AdminPanel>

      {!readOnly ? (
      <Modal
        open={!!modal}
        title={modal === "create" ? "Nouvel employe" : detail ? `Fiche employe — ${detail.name}` : "Fiche employe"}
        onClose={() => setModal(null)}
        wide
      >
        <form className="admin-form-grid" onSubmit={save}>
          <label>Nom<input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required disabled={modal === "edit"} /></label>
          {modal === "create" ? (
            <label>Mot de passe<input type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required minLength={8} /></label>
          ) : (
            <label className="admin-check">
              <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))} /> Compte actif
            </label>
          )}
          <label>Matricule<input value={form.matricule} onChange={(e) => setForm((s) => ({ ...s, matricule: e.target.value }))} /></label>
          <label>Poste<input list="admin-positions" value={form.poste} onChange={(e) => setForm((s) => ({ ...s, poste: e.target.value }))} /></label>
          <label>Service<input list="admin-departments" value={form.service} onChange={(e) => setForm((s) => ({ ...s, service: e.target.value }))} /></label>
          <datalist id="admin-positions">{(positions || []).map((p) => <option key={p} value={p} />)}</datalist>
          <datalist id="admin-departments">{(departments || []).map((d) => <option key={d} value={d} />)}</datalist>
          <label>Salaire<input type="number" min="0" value={form.salaire} onChange={(e) => setForm((s) => ({ ...s, salaire: e.target.value }))} /></label>
          <label>Date embauche<input type="date" value={form.hire_date} onChange={(e) => setForm((s) => ({ ...s, hire_date: e.target.value }))} /></label>
          <FormModalActions onCancel={() => setModal(null)} submitLabel={modal === "create" ? "Creer" : "Enregistrer"} />
        </form>
      </Modal>
      ) : null}
    </>
  );
}

export function LeavesSection({ setFlash, setError, readOnly = true }) {
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState("list");
  const [filterStatus, setFilterStatus] = useState("");
  const [editId, setEditId] = useState(null);
  const [editStatus, setEditStatus] = useState("EN_ATTENTE");

  const load = useCallback(async () => {
    try {
      const data = await getHrLeaveRequests();
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message);
    }
  }, [setError]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!filterStatus) return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  const pager = usePagedFilter(filtered, {
    searchKeys: ["employee_name", "employee_email", "leave_type", "status"],
    pageSize: 10,
  });

  const calendarEvents = useMemo(() => {
    const map = {};
    requests.filter((r) => r.status === "VALIDE").forEach((r) => {
      const key = String(r.from).slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [requests]);

  const monthStart = new Date();
  monthStart.setDate(1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

  const leaveColumns = [
    { key: "employee_name", label: "Employe" },
    { key: "leave_type", label: "Type" },
    { key: "from", label: "Du", render: (r) => fmtDate(r.from) },
    { key: "to", label: "Au", render: (r) => fmtDate(r.to) },
    { key: "status", label: "Statut", render: (r) => <StatusPill status={r.status} /> },
  ];
  if (!readOnly) {
    leaveColumns.push({
      label: "Actions",
      render: (r) =>
        r.status === "EN_ATTENTE" ? (
          <div className="admin-row-actions">
            <button
              type="button"
              className="btn-primary-solid"
              onClick={async () => {
                await patchHrLeaveRequest(r.id, "VALIDE");
                setFlash("Conge valide.");
                load();
              }}
            >
              Valider
            </button>
            <DangerRowButton
              onClick={async () => {
                await patchHrLeaveRequest(r.id, "REFUSE");
                setFlash("Conge refuse.");
                load();
              }}
            >
              Refuser
            </DangerRowButton>
          </div>
        ) : (
          <div className="admin-row-actions">
            <EditRowButton
              onClick={() => {
                setEditId(r.id);
                setEditStatus(r.status || "EN_ATTENTE");
              }}
            />
          </div>
        ),
    });
  }

  return (
    <>
      {readOnly ? <ReadOnlyBanner /> : null}
      <AdminPanel title={readOnly ? "Conges (consultation)" : "Gestion des conges"} desc={readOnly ? "Suivi des demandes — validation par le RH" : "Validation, types et calendrier"}>
      <div className="admin-subtabs">
        <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Liste</button>
        <button type="button" className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>Calendrier</button>
      </div>

      {view === "list" ? (
        <>
          <div className="admin-toolbar">
            <SearchInput value={pager.q} onChange={(v) => { pager.setQ(v); pager.setPage(1); }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="VALIDE">Valide</option>
              <option value="REFUSE">Refuse</option>
            </select>
            <button type="button" className="btn-ghost-sm" onClick={load}>Actualiser</button>
          </div>
          <DataTable columns={leaveColumns} rows={pager.slice} />
          <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} />
        </>
      ) : (
        <div className="admin-calendar">
          <p className="admin-calendar__title">
            {monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — conges valides
          </p>
          <div className="admin-calendar__grid">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const events = calendarEvents[key] || [];
              return (
                <div key={key} className={`admin-calendar__day${events.length ? " has-events" : ""}`}>
                  <span className="admin-calendar__num">{day}</span>
                  {events.slice(0, 2).map((ev) => (
                    <span key={ev.id} className="admin-calendar__ev" title={ev.employee_name}>{ev.employee_name?.split(" ")[0]}</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminPanel>

      {!readOnly ? (
        <Modal
          open={Boolean(editId)}
          title="Modifier le statut"
          onClose={() => {
            setEditId(null);
            setEditStatus("EN_ATTENTE");
          }}
        >
          <form
            className="admin-form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await patchHrLeaveRequest(editId, editStatus);
                setFlash("Statut mis a jour.");
                setEditId(null);
                load();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            <label>
              Statut
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} required>
                <option value="EN_ATTENTE">En attente</option>
                <option value="VALIDE">Valide</option>
                <option value="REFUSE">Refuse</option>
              </select>
            </label>
            <FormModalActions
              onCancel={() => {
                setEditId(null);
                setEditStatus("EN_ATTENTE");
              }}
              submitLabel="Enregistrer"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function TrainingsSection({ setFlash, setError, readOnly = true }) {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", trainer: "", location: "", start_date: "", end_date: "", capacity: 20, status: "PLANIFIE", description: "" });

  const load = useCallback(async () => {
    try {
      const data = await getHrTrainings();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }, [setError]);

  useEffect(() => {
    load();
  }, [load]);

  const pager = usePagedFilter(items, { searchKeys: ["title", "trainer", "status"], pageSize: 8 });

  const trainingColumns = [
    { key: "title", label: "Titre" },
    { key: "trainer", label: "Formateur" },
    { key: "start_date", label: "Debut", render: (r) => fmtDate(r.start_date) },
    { key: "end_date", label: "Fin", render: (r) => fmtDate(r.end_date) },
    { key: "enrolled", label: "Inscrits", render: (r) => `${(r.participants || []).length}/${r.capacity}` },
    { key: "status", label: "Statut", render: (r) => TRAINING_STATUS[r.status] || r.status },
  ];
  if (!readOnly) {
    trainingColumns.push({
      label: "",
      render: (r) => (
        <button type="button" className="danger" onClick={async () => { if (window.confirm("Supprimer ?")) { await deleteHrTraining(r.id); setFlash("Supprime."); load(); } }}>Supprimer</button>
      ),
    });
  }

  return (
    <>
      {readOnly ? <ReadOnlyBanner /> : null}
    <AdminPanel
      title={readOnly ? "Formations (consultation)" : "Formations"}
      desc={readOnly ? "Sessions et participants" : "Sessions, participants et historique"}
      actions={readOnly ? null : <button type="button" className="btn-primary-solid" onClick={() => setModal(true)}>+ Session</button>}
    >
      <SearchInput value={pager.q} onChange={(v) => { pager.setQ(v); pager.setPage(1); }} />
      <DataTable columns={trainingColumns} rows={pager.slice} />
      <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} />

      {!readOnly ? (
      <Modal open={modal} title="Nouvelle session" onClose={() => setModal(false)} wide>
        <form className="admin-form-grid" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await createHrTraining(form);
            setFlash("Session creee.");
            setModal(false);
            load();
          } catch (err) {
            setError(err.message);
          }
        }}>
          <label>Titre<input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} required /></label>
          <label>Formateur<input value={form.trainer} onChange={(e) => setForm((s) => ({ ...s, trainer: e.target.value }))} required /></label>
          <label>Lieu<input value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} /></label>
          <label>Debut<input type="date" value={form.start_date} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} required /></label>
          <label>Fin<input type="date" value={form.end_date} onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))} required /></label>
          <label>Capacite<input type="number" value={form.capacity} onChange={(e) => setForm((s) => ({ ...s, capacity: Number(e.target.value) }))} /></label>
          <label className="admin-form-span2">Description<textarea rows={3} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} /></label>
          <FormModalActions
            onCancel={() => setModal(false)}
            showCancel
            submitLabel="Creer"
          />
        </form>
      </Modal>
      ) : null}
    </AdminPanel>
    </>
  );
}

export function EvaluationsSection({ setFlash, setError, readOnly = true }) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    try {
      const data = await getHrEvaluations();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }, [setError]);
  useEffect(() => {
    load();
  }, [load]);
  const pager = usePagedFilter(items, { searchKeys: ["employee_name", "employee_email", "period_label", "status"], pageSize: 8 });

  return (
    <>
      {readOnly ? <ReadOnlyBanner /> : null}
    <AdminPanel title={readOnly ? "Evaluations (consultation)" : "Evaluations de performance"} desc="Scores, commentaires et historique">
      <SearchInput value={pager.q} onChange={(v) => { pager.setQ(v); pager.setPage(1); }} />
      <DataTable
        columns={[
          { key: "employee_name", label: "Employe" },
          { key: "period_label", label: "Periode" },
          { key: "reviewer_name", label: "Evaluateur" },
          { key: "score", label: "Score", render: (r) => (r.score ? `${r.score}/5` : "—") },
          { key: "summary", label: "Commentaire", render: (r) => <span className="admin-cell-clamp">{r.summary || "—"}</span> },
          { key: "status", label: "Statut" },
        ]}
        rows={pager.slice}
      />
      <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} />
    </AdminPanel>
    </>
  );
}

export function RecruitmentSection({ setError, readOnly = true }) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    try {
      const data = await getHrRecruitment();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }, [setError]);
  useEffect(() => {
    load();
  }, [load]);
  const pager = usePagedFilter(items, {
    searchKeys: ["job_title", "candidate_name", "email", "status"],
    pageSize: 10,
  });

  return (
    <>
      {readOnly ? <ReadOnlyBanner /> : null}
      <AdminPanel title="Recrutement (consultation)" desc="Pipeline candidatures — lecture seule pour l administrateur">
        <DataTable
          columns={[
            { key: "job_title", label: "Poste" },
            { key: "candidate_name", label: "Candidat" },
            { key: "email", label: "Email" },
            { key: "status", label: "Statut" },
            { key: "notes", label: "Notes" },
          ]}
          rows={pager.slice}
        />
        <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} />
      </AdminPanel>
    </>
  );
}

export function CareersSection({ setFlash, setError, readOnly = true }) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    try {
      const data = await getHrCareers();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }, [setError]);
  useEffect(() => {
    load();
  }, [load]);
  const pager = usePagedFilter(items, { searchKeys: ["employee_name", "current_role", "target_role", "status"], pageSize: 8 });

  return (
    <>
      {readOnly ? <ReadOnlyBanner /> : null}
    <AdminPanel title={readOnly ? "Carrieres (consultation)" : "Carrieres & promotions"} desc="Plans de carriere et jalons">
      <DataTable
        columns={[
          { key: "employee_name", label: "Employe" },
          { key: "current_role", label: "Poste actuel" },
          { key: "target_role", label: "Objectif" },
          { key: "status", label: "Statut" },
          {
            key: "milestones",
            label: "Jalons",
            render: (r) => `${(r.milestones || []).filter((m) => m.done).length}/${(r.milestones || []).length}`,
          },
        ]}
        rows={pager.slice}
      />
      <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} />
    </AdminPanel>
    </>
  );
}

export function ReportsSection({ setError }) {
  async function exportType(type) {
    try {
      const csv = await getAdminReport(type, "csv");
      downloadCsv(`rapport-${type}.csv`, csv);
    } catch (e) {
      setError(e.message);
    }
  }

  const cards = [
    { type: "employees", title: "Rapport employes", desc: "Matricule, poste, service, salaire" },
    { type: "leaves", title: "Rapport conges", desc: "Demandes et statuts" },
    { type: "evaluations", title: "Rapport evaluations", desc: "Scores et periodes" },
  ];

  return (
    <>
    <AdminPanel title="Gestion des rapports" desc="Exports CSV pour pilotage et administration (compatible Excel)">
      <div className="admin-report-grid">
        {cards.map((c) => (
          <article key={c.type} className="admin-report-card">
            <h4>{c.title}</h4>
            <p className="muted">{c.desc}</p>
            <button type="button" className="btn-primary-solid" onClick={() => exportType(c.type)}>
              Exporter CSV
            </button>
          </article>
        ))}
      </div>
      <p className="muted admin-report-note">Export PDF : utilisez l impression du navigateur sur les tableaux apres export Excel.</p>
    </AdminPanel>
    </>
  );
}

export function NotificationsSection({ setError, readOnly = true }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    getAdminNotifications()
      .then((d) => {
        setItems(d.items || []);
        setUnread(d.unread_count || 0);
      })
      .catch((e) => setError(e.message));
  }, [setError]);

  return (
    <AdminPanel title="Notifications & alertes" desc={`${unread} alerte(s) — suivi en lecture seule`}>
      <ul className="admin-notif-list">
        {items.map((n) => (
          <li key={n.id} className={`admin-notif admin-notif--${n.level}${n.read ? "" : " admin-notif--unread"}`}>
            <strong>{n.title}</strong>
            <p>{n.message}</p>
            <time>{fmtDateTime(n.created_at)}</time>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="muted">Aucune notification.</p> : null}
    </AdminPanel>
  );
}
