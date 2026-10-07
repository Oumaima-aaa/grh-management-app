import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  createEmployeeHrInfoRequest,
  enrollEmployeeTraining,
  getEmployeeCareer,
  getEmployeeEvaluations,
  getEmployeeHrInfoRequests,
  getEmployeeTrainings,
  participateEmployeeEvaluation,
} from "../api";
import {
  EMPLOYEE_TAB_ORDER,
  EMPLOYEE_TAB_PERMISSIONS,
  filterEmployeeTabs,
  firstAllowedEmployeeTab,
  hasPermission,
} from "../permissions";

const LEAVE_STATUS_LABEL = {
  EN_ATTENTE: "En attente",
  VALIDE: "Valide",
  REFUSE: "Refuse",
};

const LEAVE_TYPE_LABEL = {
  ANNUEL: "Conge annuel",
  MALADIE: "Maladie",
  SANS_SOLDE: "Sans solde",
  AUTRE: "Autre",
};

const EVAL_STATUS_LABEL = {
  PLANIFIE: "Planifie",
  REALISE: "Realise",
};

const INFO_STATUS_LABEL = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TRAITEE: "Traitee",
  FERMEE: "Fermee",
};

const CAREER_STATUS_LABEL = {
  ACTIF: "En cours",
  TERMINE: "Termine",
  EN_PAUSE: "En pause",
};

function empTabClass(active) {
  return `emp-tab${active ? " emp-tab--active" : ""}`;
}

function leavePillClass(status) {
  const s = status || "EN_ATTENTE";
  if (s === "VALIDE") return "emp-pill emp-pill--ok";
  if (s === "REFUSE") return "emp-pill emp-pill--danger";
  return "emp-pill emp-pill--pending";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("fr-FR");
}

function formatSalary(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function profileInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "EM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function leaveDays(from, to) {
  if (!from || !to) return null;
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

function EmpModuleHeader({ icon, title, description, aside }) {
  return (
    <header className="emp-module-head">
      <div className="emp-module-head__main">
        <span className="emp-module-head__icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h3 className="emp-module-head__title">{title}</h3>
          {description ? <p className="emp-module-head__desc">{description}</p> : null}
        </div>
      </div>
      {aside ? <div className="emp-module-head__aside">{aside}</div> : null}
    </header>
  );
}

function EmpStatChip({ label, value, tone = "default" }) {
  return (
    <div className={`emp-stat-chip emp-stat-chip--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmpEmptyState({ title, message }) {
  return (
    <div className="emp-empty-state">
      <p className="emp-empty-state__title">{title}</p>
      <p className="muted">{message}</p>
    </div>
  );
}

function computeTenure(hireDate) {
  if (!hireDate) return null;
  const start = new Date(hireDate);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) return `${years} an${years > 1 ? "s" : ""} et ${rem} mois`;
  if (years > 0) return `${years} an${years > 1 ? "s" : ""}`;
  return `${rem} mois`;
}

function requestKey(r, index) {
  const id = r.id ?? r._id;
  return id != null && id !== "" ? String(id) : `req-${index}`;
}

export function EmployeePage({ currentUser = null }) {
  const allowedTabs = useMemo(
    () => filterEmployeeTabs(EMPLOYEE_TAB_ORDER, currentUser),
    [currentUser]
  );
  const [tab, setTab] = useState(() => firstAllowedEmployeeTab(EMPLOYEE_TAB_ORDER, currentUser));
  const tabAllowed = hasPermission(currentUser, EMPLOYEE_TAB_PERMISSIONS[tab]);

  useEffect(() => {
    if (!allowedTabs.includes(tab)) {
      const next = firstAllowedEmployeeTab(EMPLOYEE_TAB_ORDER, currentUser);
      if (next) setTab(next);
    }
  }, [tab, allowedTabs, currentUser]);

  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [career, setCareer] = useState(null);
  const [infoRequests, setInfoRequests] = useState([]);
  const [infoSubject, setInfoSubject] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [evalDraft, setEvalDraft] = useState({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [leaveType, setLeaveType] = useState("ANNUEL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const can = (slug) => hasPermission(currentUser, slug);
      const tasks = [];

      if (can("view_own_profile")) {
        tasks.push(api("/employee/profile").then((p) => setProfile(p.profile)));
      } else {
        setProfile(null);
      }
      if (can("view_own_leaves")) {
        tasks.push(api("/employee/leave-requests").then((r) => setRequests(r.requests || [])));
      } else {
        setRequests([]);
      }
      if (can("view_own_trainings")) {
        tasks.push(getEmployeeTrainings().then((t) => setTrainings(t.items || [])));
      } else {
        setTrainings([]);
      }
      if (can("view_own_evaluations")) {
        tasks.push(getEmployeeEvaluations().then((e) => setEvaluations(e.items || [])));
      } else {
        setEvaluations([]);
      }
      if (can("view_own_career")) {
        tasks.push(getEmployeeCareer().then((c) => setCareer(c.plan || null)));
      } else {
        setCareer(null);
      }
      if (can("view_own_hr_info")) {
        tasks.push(getEmployeeHrInfoRequests().then((info) => setInfoRequests(info.items || [])));
      } else {
        setInfoRequests([]);
      }

      await Promise.all(tasks);
    } catch (err) {
      setError(err?.message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = window.setTimeout(() => setFlash(""), 4500);
    return () => window.clearTimeout(t);
  }, [flash]);

  const stats = useMemo(() => {
    const pending = requests.filter((x) => (x.status || "EN_ATTENTE") === "EN_ATTENTE").length;
    const enrolledTrainings = trainings.filter((t) => t.is_enrolled).length;
    return {
      total: requests.length,
      pending,
      accepted: requests.filter((x) => x.status === "VALIDE").length,
      enrolledTrainings,
      evalCount: evaluations.length,
    };
  }, [requests, trainings, evaluations]);

  async function submitRequest(e) {
    e.preventDefault();
    if (from && to && new Date(`${to}T12:00:00`) < new Date(`${from}T12:00:00`)) {
      setError("La date de fin doit etre la meme journee ou apres la date de debut.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api("/employee/leave-requests", {
        method: "POST",
        body: JSON.stringify({ from, to, leave_type: leaveType }),
      });
      setFlash("Demande envoyee. Le responsable RH la traitera sous peu.");
      setFrom("");
      setTo("");
      setLeaveType("ANNUEL");
      await refresh();
    } catch (err) {
      setError(err?.message || "Envoi impossible");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnroll(trainingId) {
    setError("");
    try {
      await enrollEmployeeTraining(trainingId);
      setFlash("Inscription a la formation confirmee.");
      await refresh();
    } catch (err) {
      setError(err?.message || "Inscription impossible");
    }
  }

  async function handleParticipation(evId) {
    const comment = (evalDraft[evId] || "").trim();
    if (comment.length < 5) {
      setError("Votre commentaire doit contenir au moins 5 caracteres.");
      return;
    }
    try {
      await participateEmployeeEvaluation(evId, { employee_comment: comment });
      setFlash("Votre participation a ete enregistree.");
      setEvalDraft((s) => ({ ...s, [evId]: "" }));
      await refresh();
    } catch (err) {
      setError(err?.message || "Participation impossible");
    }
  }

  async function submitInfoRequest(e) {
    e.preventDefault();
    try {
      await createEmployeeHrInfoRequest({ subject: infoSubject, message: infoMessage });
      setInfoSubject("");
      setInfoMessage("");
      setFlash("Demande RH envoyee.");
      await refresh();
    } catch (err) {
      setError(err?.message || "Envoi impossible");
    }
  }

  return (
    <div className="emp-shell">
      {flash ? <p className="emp-flash success">{flash}</p> : null}
      {error ? <p className="emp-flash error">{error}</p> : null}

      <section className="card emp-hero">
        <div className="emp-hero-strip">
          <div>
            <p className="emp-hero-eyebrow">Mon espace</p>
            <h2 className="emp-hero-title">Espace employe</h2>
            <p className="emp-hero-lede">
              Gerez votre profil, vos conges, formations, evaluations et echanges avec les RH.
            </p>
          </div>
          <button type="button" className="btn-emp-refresh" onClick={refresh} disabled={loading}>
            <span className="btn-emp-refresh__icon" aria-hidden>
              ↻
            </span>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
        <div className="emp-kpi-row">
          <button type="button" className="emp-kpi" onClick={() => setTab("conges")}>
            <span className="emp-kpi__label">Conges</span>
            <span className="emp-kpi__value">{stats.total}</span>
          </button>
          <button type="button" className="emp-kpi emp-kpi--amber" onClick={() => setTab("conges")}>
            <span className="emp-kpi__label">En attente</span>
            <span className="emp-kpi__value">{stats.pending}</span>
          </button>
          <button type="button" className="emp-kpi emp-kpi--blue" onClick={() => setTab("formations")}>
            <span className="emp-kpi__label">Formations</span>
            <span className="emp-kpi__value">{stats.enrolledTrainings}</span>
          </button>
          <button type="button" className="emp-kpi emp-kpi--slate" onClick={() => setTab("evaluations")}>
            <span className="emp-kpi__label">Evaluations</span>
            <span className="emp-kpi__value">{stats.evalCount}</span>
          </button>
        </div>
      </section>

      <div className="emp-tab-row" role="tablist">
        {allowedTabs.map((tabId) => (
          <button
            key={tabId}
            type="button"
            className={empTabClass(tab === tabId)}
            onClick={() => setTab(tabId)}
          >
            {{
              profil: "Profil",
              conges: "Conges",
              formations: "Formations",
              evaluations: "Evaluations",
              carriere: "Carriere",
              infos: "Infos RH",
            }[tabId] || tabId}
          </button>
        ))}
      </div>

      {!allowedTabs.length ? (
        <EmpEmptyState
          title="Aucun module assigne"
          message="Contactez l administrateur pour vous attribuer des modules (ex. Mon profil uniquement)."
        />
      ) : null}

      {tab === "profil" && tabAllowed && (
        <section className="card emp-card emp-profile-card">
          {loading && !profile ? (
            <div className="emp-profile-skeleton" aria-busy="true">
              <div className="emp-profile-skeleton__header" />
              <div className="emp-profile-skeleton__grid" />
            </div>
          ) : profile ? (
            <>
              <header className="emp-profile-banner">
                <div className="emp-profile-banner__main">
                  <div className="emp-profile-avatar" aria-hidden>
                    {profileInitials(profile.name)}
                  </div>
                  <div className="emp-profile-identity">
                    <p className="emp-profile-eyebrow">Fiche employe</p>
                    <h3 className="emp-profile-name">{profile.name}</h3>
                    <p className="emp-profile-role-line">
                      {profile.poste || profile.post || "Poste non renseigne"}
                      {profile.service ? (
                        <>
                          <span className="emp-profile-dot" aria-hidden>
                            ·
                          </span>
                          {profile.service}
                        </>
                      ) : null}
                    </p>
                    <div className="emp-profile-badges">
                      <span className="emp-profile-badge emp-profile-badge--role">Employe</span>
                      {profile.matricule ? (
                        <span className="emp-profile-badge emp-profile-badge--muted">
                          Matricule {profile.matricule}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="emp-profile-highlights">
                  <div className="emp-profile-highlight">
                    <span className="emp-profile-highlight__label">Embauche</span>
                    <strong>{formatDate(profile.hire_date)}</strong>
                  </div>
                  <div className="emp-profile-highlight">
                    <span className="emp-profile-highlight__label">Anciennete</span>
                    <strong>{computeTenure(profile.hire_date) || "—"}</strong>
                  </div>
                  <div className="emp-profile-highlight emp-profile-highlight--accent">
                    <span className="emp-profile-highlight__label">Remuneration</span>
                    <strong>{formatSalary(profile.salaire)}</strong>
                  </div>
                </div>
              </header>

              <div className="emp-profile-sections">
                <article className="emp-profile-section">
                  <h4 className="emp-profile-section__title">
                    <span className="emp-profile-section__icon" aria-hidden>
                      👤
                    </span>
                    Informations personnelles
                  </h4>
                  <dl className="emp-profile-grid">
                    <div className="emp-profile-field">
                      <dt>Nom complet</dt>
                      <dd>{profile.name}</dd>
                    </div>
                    <div className="emp-profile-field">
                      <dt>Adresse e-mail</dt>
                      <dd>
                        <a href={`mailto:${profile.email}`} className="emp-profile-link">
                          {profile.email}
                        </a>
                      </dd>
                    </div>
                    <div className="emp-profile-field">
                      <dt>Matricule</dt>
                      <dd>{profile.matricule || "—"}</dd>
                    </div>
                  </dl>
                </article>

                <article className="emp-profile-section">
                  <h4 className="emp-profile-section__title">
                    <span className="emp-profile-section__icon" aria-hidden>
                      🏢
                    </span>
                    Poste et organisation
                  </h4>
                  <dl className="emp-profile-grid">
                    <div className="emp-profile-field">
                      <dt>Intitule du poste</dt>
                      <dd>{profile.poste || profile.post || "—"}</dd>
                    </div>
                    <div className="emp-profile-field">
                      <dt>Service / departement</dt>
                      <dd>{profile.service || "—"}</dd>
                    </div>
                    <div className="emp-profile-field">
                      <dt>Date d embauche</dt>
                      <dd>{formatDate(profile.hire_date)}</dd>
                    </div>
                  </dl>
                </article>

                <article className="emp-profile-section emp-profile-section--full">
                  <h4 className="emp-profile-section__title">
                    <span className="emp-profile-section__icon" aria-hidden>
                      📋
                    </span>
                    Synthese RH
                  </h4>
                  <p className="emp-profile-note muted">
                    Ces informations sont gerees par le service RH. Pour toute mise a jour, utilisez l onglet{" "}
                    <button type="button" className="emp-inline-link" onClick={() => setTab("infos")}>
                      Infos RH
                    </button>
                    .
                  </p>
                  <div className="emp-profile-summary-row">
                    <div className="emp-profile-summary-card">
                      <span>Matricule</span>
                      <strong>{profile.matricule || "—"}</strong>
                    </div>
                    <div className="emp-profile-summary-card">
                      <span>Anciennete</span>
                      <strong>{computeTenure(profile.hire_date) || "—"}</strong>
                    </div>
                    <div className="emp-profile-summary-card">
                      <span>Remuneration brute</span>
                      <strong>{formatSalary(profile.salaire)}</strong>
                    </div>
                  </div>
                </article>
              </div>
            </>
          ) : (
            <div className="emp-profile-empty">
              <p className="emp-profile-empty__title">Profil indisponible</p>
              <p className="muted">Votre fiche employe n a pas encore ete configuree par les RH.</p>
              <button type="button" className="btn-primary-solid" onClick={() => setTab("infos")}>
                Contacter les RH
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "conges" && tabAllowed && (
        <div className="emp-module">
          <section className="card emp-card emp-module-card">
            <EmpModuleHeader
              icon="📅"
              title="Gestion des conges"
              description="Deposez une demande et suivez sa validation par le service RH."
              aside={
                <>
                  <EmpStatChip label="Total" value={stats.total} />
                  <EmpStatChip label="En attente" value={stats.pending} tone="amber" />
                  <EmpStatChip label="Acceptees" value={stats.accepted} tone="blue" />
                </>
              }
            />
            <div className="emp-module-body emp-grid">
              <div className="emp-form-panel">
                <h4 className="emp-subpanel-title">Nouvelle demande</h4>
                <form className="emp-leave-form" onSubmit={submitRequest}>
                  <div className="emp-leave-fields">
                    <div className="emp-field">
                      <label htmlFor="emp-leave-type">Type de conge</label>
                      <select id="emp-leave-type" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                        {Object.entries(LEAVE_TYPE_LABEL).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="emp-field">
                      <label htmlFor="emp-leave-from">Date de debut</label>
                      <input
                        id="emp-leave-from"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        required
                      />
                    </div>
                    <div className="emp-field">
                      <label htmlFor="emp-leave-to">Date de fin</label>
                      <input
                        id="emp-leave-to"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {leaveDays(from, to) ? (
                    <p className="emp-form-hint">
                      Duree estimee : <strong>{leaveDays(from, to)} jour(s)</strong>
                    </p>
                  ) : null}
                  <button type="submit" className="btn-primary-solid emp-btn-block" disabled={submitting || loading}>
                    {submitting ? "Envoi en cours…" : "Envoyer la demande"}
                  </button>
                </form>
              </div>

              <div className="emp-list-panel">
                <h4 className="emp-subpanel-title">Historique des demandes</h4>
                {requests.length === 0 ? (
                  <EmpEmptyState
                    title="Aucune demande de conge"
                    message="Vos demandes apparaitront ici apres envoi."
                  />
                ) : (
                  <ul className="emp-leave-list">
                    {requests.map((r, idx) => (
                      <li key={requestKey(r, idx)} className="emp-leave-item">
                        <div className="emp-leave-item__main">
                          <strong>{LEAVE_TYPE_LABEL[r.leave_type] || r.leave_type || "Conge"}</strong>
                          <span className="muted">
                            {formatDate(r.from)} → {formatDate(r.to)}
                            {leaveDays(r.from, r.to) ? ` · ${leaveDays(r.from, r.to)} j` : ""}
                          </span>
                        </div>
                        <span className={leavePillClass(r.status)}>
                          {LEAVE_STATUS_LABEL[r.status] || r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "formations" && tabAllowed && (
        <section className="card emp-card emp-module-card">
          <EmpModuleHeader
            icon="🎓"
            title="Formations"
            description="Consultez les sessions ouvertes et inscrivez-vous en un clic."
            aside={<EmpStatChip label="Inscriptions" value={stats.enrolledTrainings} tone="blue" />}
          />
          <div className="emp-module-body">
            {trainings.length === 0 ? (
              <EmpEmptyState
                title="Aucune formation disponible"
                message="Le service RH publiera bientot de nouvelles sessions."
              />
            ) : (
              <div className="emp-training-grid">
                {trainings.map((t) => {
                  const cap = Number(t.capacity) || 0;
                  const enrolled = Number(t.enrolled_count) || 0;
                  const pct = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
                  return (
                    <article key={t.id} className="emp-training-card">
                      <div className="emp-training-card__head">
                        <span className="emp-training-card__icon" aria-hidden>
                          🎓
                        </span>
                        <div>
                          <h4 className="emp-training-card__title">{t.title}</h4>
                          <p className="muted">{t.trainer || "Formateur a confirmer"}</p>
                        </div>
                      </div>
                      <ul className="emp-training-meta">
                        <li>
                          <span>Periode</span>
                          <strong>
                            {formatDate(t.start_date)} → {formatDate(t.end_date)}
                          </strong>
                        </li>
                        {t.location ? (
                          <li>
                            <span>Lieu</span>
                            <strong>{t.location}</strong>
                          </li>
                        ) : null}
                        <li>
                          <span>Places</span>
                          <strong>
                            {enrolled} / {cap || "—"}
                          </strong>
                        </li>
                      </ul>
                      {cap > 0 ? (
                        <div className="emp-progress" aria-hidden>
                          <div className="emp-progress__bar" style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                      <div className="emp-training-card__actions">
                        {t.is_enrolled ? (
                          <span className="emp-pill emp-pill--ok">Inscription confirmee</span>
                        ) : (
                          <button type="button" className="btn-primary-solid" onClick={() => handleEnroll(t.id)}>
                            S inscrire
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "evaluations" && tabAllowed && (
        <section className="card emp-card emp-module-card">
          <EmpModuleHeader
            icon="⭐"
            title="Evaluations de performance"
            description="Consultez vos evaluations et partagez votre retour employe."
            aside={<EmpStatChip label="Evaluations" value={stats.evalCount} tone="slate" />}
          />
          <div className="emp-module-body">
            {evaluations.length === 0 ? (
              <EmpEmptyState
                title="Aucune evaluation"
                message="Vos evaluations apparaitront ici lorsqu elles seront planifiees par les RH."
              />
            ) : (
              <div className="emp-eval-list">
                {evaluations.map((ev, idx) => (
                  <article key={ev.id ?? `ev-${idx}`} className="emp-eval-card">
                    <div className="emp-eval-card__head">
                      <div>
                        <h4>{ev.period_label || "Evaluation"}</h4>
                        <p className="muted">Evaluateur : {ev.reviewer_name || "—"}</p>
                      </div>
                      <div className="emp-eval-card__badges">
                        <span className="emp-pill emp-pill--slate">
                          {EVAL_STATUS_LABEL[ev.status] || ev.status}
                        </span>
                        {ev.score != null ? (
                          <span className="emp-score-badge">{ev.score} / 5</span>
                        ) : null}
                      </div>
                    </div>
                    {ev.summary ? (
                      <div className="emp-eval-block">
                        <span className="emp-eval-block__label">Synthese RH</span>
                        <p>{ev.summary}</p>
                      </div>
                    ) : null}
                    <div className="emp-eval-block">
                      <span className="emp-eval-block__label">Votre participation</span>
                      {ev.employee_comment ? (
                        <p className="emp-eval-comment">{ev.employee_comment}</p>
                      ) : (
                        <div className="emp-participation-form">
                          <textarea
                            rows={3}
                            placeholder="Partagez votre retour sur cette periode..."
                            value={evalDraft[ev.id] || ""}
                            onChange={(e) => setEvalDraft((s) => ({ ...s, [ev.id]: e.target.value }))}
                          />
                          <button type="button" className="btn-primary-solid" onClick={() => handleParticipation(ev.id)}>
                            Envoyer ma participation
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "carriere" && tabAllowed && (
        <section className="card emp-card emp-module-card">
          <EmpModuleHeader
            icon="📈"
            title="Plan de carriere"
            description="Visualisez votre trajectoire professionnelle et vos objectifs."
          />
          <div className="emp-module-body">
            {!career ? (
              <EmpEmptyState
                title="Aucun plan de carriere"
                message="Votre responsable RH definira un plan lors de votre entretien annuel."
              />
            ) : (
              <div className="emp-career-layout">
                <div className="emp-career-overview">
                  <div className="emp-career-step">
                    <span className="emp-career-step__label">Actuel</span>
                    <strong>{career.current_role || "—"}</strong>
                  </div>
                  <div className="emp-career-arrow" aria-hidden>
                    →
                  </div>
                  <div className="emp-career-step emp-career-step--target">
                    <span className="emp-career-step__label">Objectif</span>
                    <strong>{career.target_role || "—"}</strong>
                  </div>
                </div>
                <div className="emp-career-meta-row">
                  <EmpStatChip
                    label="Statut"
                    value={CAREER_STATUS_LABEL[career.status] || career.status || "—"}
                    tone="slate"
                  />
                </div>
                {career.notes ? (
                  <div className="emp-eval-block">
                    <span className="emp-eval-block__label">Notes du plan</span>
                    <p>{career.notes}</p>
                  </div>
                ) : null}
                <h4 className="emp-subpanel-title">Jalons de progression</h4>
                <ul className="emp-milestone-timeline">
                  {(career.milestones || []).length === 0 ? (
                    <li className="emp-milestone-timeline__empty muted">Aucun jalon defini.</li>
                  ) : (
                    (career.milestones || []).map((m, i) => (
                      <li
                        key={`${m.title}-${i}`}
                        className={`emp-milestone-timeline__item${m.done ? " emp-milestone-timeline__item--done" : ""}`}
                      >
                        <span className="emp-milestone-timeline__dot" aria-hidden />
                        <div className="emp-milestone-timeline__content">
                          <strong>{m.title}</strong>
                          {m.due_date ? <span className="muted">Echeance : {formatDate(m.due_date)}</span> : null}
                        </div>
                        {m.done ? <span className="emp-pill emp-pill--ok">Realise</span> : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "infos" && tabAllowed && (
        <section className="card emp-card emp-module-card">
          <EmpModuleHeader
            icon="💬"
            title="Informations RH"
            description="Contactez le service RH et suivez l etat de vos demandes."
            aside={
              <EmpStatChip
                label="En attente"
                value={infoRequests.filter((r) => (r.status || "EN_ATTENTE") === "EN_ATTENTE").length}
                tone="amber"
              />
            }
          />
          <div className="emp-module-body emp-grid">
            <div className="emp-form-panel">
              <h4 className="emp-subpanel-title">Nouvelle demande</h4>
              <form className="emp-leave-form" onSubmit={submitInfoRequest}>
                <div className="emp-field">
                  <label htmlFor="info-subject">Objet</label>
                  <input
                    id="info-subject"
                    placeholder="Ex. Attestation de travail"
                    value={infoSubject}
                    onChange={(e) => setInfoSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="emp-field">
                  <label htmlFor="info-message">Message</label>
                  <textarea
                    id="info-message"
                    rows={5}
                    placeholder="Decrivez votre besoin en detail..."
                    value={infoMessage}
                    onChange={(e) => setInfoMessage(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary-solid emp-btn-block">
                  Envoyer au service RH
                </button>
              </form>
            </div>

            <div className="emp-list-panel">
              <h4 className="emp-subpanel-title">Suivi des demandes</h4>
              {infoRequests.length === 0 ? (
                <EmpEmptyState
                  title="Aucune demande"
                  message="Vos echanges avec les RH s afficheront ici."
                />
              ) : (
                <ul className="emp-info-list">
                  {infoRequests.map((row) => (
                    <li key={row.id} className="emp-info-card">
                      <div className="emp-info-card__head">
                        <strong>{row.subject}</strong>
                        <span
                          className={
                            row.status === "TRAITEE" || row.status === "FERMEE"
                              ? "emp-pill emp-pill--ok"
                              : row.status === "EN_COURS"
                                ? "emp-pill emp-pill--progress"
                                : "emp-pill emp-pill--pending"
                          }
                        >
                          {INFO_STATUS_LABEL[row.status] || row.status}
                        </span>
                      </div>
                      <p className="muted emp-info-card__date">Envoyee le {formatDate(row.created_at)}</p>
                      {row.message ? <p className="emp-info-card__message">{row.message}</p> : null}
                      <div className="emp-info-card__response">
                        <span className="emp-eval-block__label">Reponse RH</span>
                        <p>{row.response || "En attente de traitement par le service RH."}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
