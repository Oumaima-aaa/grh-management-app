import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createHrCareer,
  createHrEvaluation,
  createHrRecruitment,
  createHrTraining,
  deleteHrCareer,
  deleteHrEvaluation,
  deleteHrRecruitment,
  deleteHrTraining,
  getHrCareers,
  getHrEvaluations,
  getHrLeaveRequests,
  getHrRecruitment,
  getHrInfoRequests,
  getHrTrainings,
  patchHrCareer,
  patchHrEvaluation,
  patchHrLeaveRequest,
  patchHrRecruitment,
  patchHrTraining,
} from "../api";
import { DangerRowButton, EditRowButton, FormModalActions, Modal } from "../admin/components/ui";
import { HrInfoRequestsSection } from "./HrInfoRequestsSection";
import { HrEmptyState, HrSection, HrStatChip, HrSubpanelTitle } from "./hrUi";
import {
  filterHrTabs,
  firstAllowedHrTab,
  hasAnyPermission,
  hrTabAllowed,
} from "../permissions";

const HR_TAB_ORDER = [
  "conges",
  "recruitment",
  "evaluations",
  "trainings",
  "careers",
  "infosrh",
];

const RECRUIT_STATUS = [
  ["NOUVEAU", "Nouveau"],
  ["PRESENTE", "Presente"],
  ["ENTRETIEN", "Entretien"],
  ["OFFRE", "Offre"],
  ["EMBAUCHE", "Embauche"],
  ["REFUS", "Refus"],
];

const EVAL_STATUS = [
  ["PLANIFIE", "Planifie"],
  ["REALISE", "Realise"],
];

const TRAIN_STATUS = [
  ["PLANIFIE", "Planifie"],
  ["EN_COURS", "En cours"],
  ["TERMINE", "Termine"],
];

const CAREER_STATUS = [
  ["ACTIF", "Actif"],
  ["TERMINE", "Termine"],
];

const LEAVE_STATUS_LABEL = {
  EN_ATTENTE: "En attente",
  VALIDE: "Valide",
  REFUSE: "Refuse",
};

const LEAVE_TYPE_LABEL = {
  ANNUEL: "Annuel",
  MALADIE: "Maladie",
  SANS_SOLDE: "Sans solde",
  AUTRE: "Autre",
};

function rowId(row) {
  const id = row.id ?? row._id;
  return id != null && id !== "" ? String(id) : null;
}

function hrTabClass(active) {
  return `hr-tab${active ? " hr-tab--active" : ""}`;
}

export function HrPage({ currentUser = null }) {
  const allowedTabs = useMemo(
    () => filterHrTabs(HR_TAB_ORDER, currentUser),
    [currentUser]
  );
  const [tab, setTab] = useState(() => firstAllowedHrTab(HR_TAB_ORDER, currentUser));

  useEffect(() => {
    if (!allowedTabs.includes(tab)) {
      const next = firstAllowedHrTab(HR_TAB_ORDER, currentUser);
      if (next) setTab(next);
    }
  }, [tab, allowedTabs, currentUser]);

  const tabAllowed = hrTabAllowed(currentUser, tab);
  const canManageHrInfo = hasAnyPermission(currentUser, ["manage_hr_info", "manage_employees"]);
  const [flash, setFlash] = useState({ kind: "", text: "" });

  const notify = useCallback((kind, text) => {
    setFlash({ kind, text });
  }, []);

  useEffect(() => {
    if (!flash.text) return undefined;
    const t = window.setTimeout(() => setFlash({ kind: "", text: "" }), 5000);
    return () => window.clearTimeout(t);
  }, [flash.text]);

  const onErr = useCallback(
    (err) => {
      notify("err", err?.message || "Erreur");
    },
    [notify]
  );

  const [leaveRows, setLeaveRows] = useState([]);
  const loadLeaves = useCallback(async () => {
    try {
      const r = await getHrLeaveRequests();
      setLeaveRows(r.requests || []);
    } catch (e) {
      onErr(e);
    }
  }, [onErr]);

  const [recruit, setRecruit] = useState([]);
  const loadRecruit = useCallback(async () => {
    try {
      const r = await getHrRecruitment();
      setRecruit(r.items || []);
    } catch (e) {
      onErr(e);
    }
  }, [onErr]);

  const [evals, setEvals] = useState([]);
  const loadEvals = useCallback(async () => {
    try {
      const r = await getHrEvaluations();
      setEvals(r.items || []);
    } catch (e) {
      onErr(e);
    }
  }, [onErr]);

  const [trainings, setTrainings] = useState([]);
  const loadTrainings = useCallback(async () => {
    try {
      const r = await getHrTrainings();
      setTrainings(r.items || []);
    } catch (e) {
      onErr(e);
    }
  }, [onErr]);

  const [careers, setCareers] = useState([]);
  const [milestoneDraft, setMilestoneDraft] = useState({});
  const [hrRefreshing, setHrRefreshing] = useState(true);
  const [infoRequests, setInfoRequests] = useState([]);

  const loadCareers = useCallback(async () => {
    try {
      const r = await getHrCareers();
      setCareers(r.items || []);
    } catch (e) {
      onErr(e);
    }
  }, [onErr]);

  const loadInfoRequests = useCallback(async () => {
    try {
      const r = await getHrInfoRequests();
      setInfoRequests(r.items || []);
    } catch (e) {
      onErr(e);
    }
  }, [onErr]);

  const refreshAll = useCallback(async () => {
    setHrRefreshing(true);
    try {
      await Promise.all([
        loadLeaves(),
        loadRecruit(),
        loadEvals(),
        loadTrainings(),
        loadCareers(),
        loadInfoRequests(),
      ]);
    } finally {
      setHrRefreshing(false);
    }
  }, [loadLeaves, loadRecruit, loadEvals, loadTrainings, loadCareers, loadInfoRequests]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (tab === "infosrh" && hrTabAllowed(currentUser, "infosrh")) {
      loadInfoRequests();
    }
  }, [tab, currentUser, loadInfoRequests]);

  const kpis = useMemo(() => {
    const pendingLeaves = leaveRows.filter((r) => (r.status || "EN_ATTENTE") === "EN_ATTENTE").length;
    const activeRecruit = recruit.filter(
      (r) => r.status && !["EMBAUCHE", "REFUS"].includes(r.status)
    ).length;
    const plannedEvals = evals.filter((r) => (r.status || "PLANIFIE") === "PLANIFIE").length;
    const runningTrainings = trainings.filter((r) =>
      ["PLANIFIE", "EN_COURS"].includes(r.status || "PLANIFIE")
    ).length;
    const activeCareers = careers.filter((r) => (r.status || "ACTIF") === "ACTIF").length;
    const infoPending = infoRequests.filter((r) => (r.status || "EN_ATTENTE") === "EN_ATTENTE").length;
    return {
      pendingLeaves,
      activeRecruit,
      plannedEvals,
      runningTrainings,
      activeCareers,
      infoPending,
    };
  }, [leaveRows, recruit, evals, trainings, careers, infoRequests]);

  async function updateLeave(id, status) {
    try {
      await patchHrLeaveRequest(id, status);
      notify("ok", "Demande de conge mise a jour.");
      loadLeaves();
    } catch (e) {
      onErr(e);
    }
  }

  const [leaveEditId, setLeaveEditId] = useState(null);
  const [leaveEditForm, setLeaveEditForm] = useState({ status: "EN_ATTENTE" });

  function openLeaveEdit(leaveId, currentStatus) {
    setLeaveEditId(leaveId);
    setLeaveEditForm({ status: currentStatus || "EN_ATTENTE" });
  }

  function closeLeaveEdit() {
    setLeaveEditId(null);
    setLeaveEditForm({ status: "EN_ATTENTE" });
  }

  async function submitLeaveEdit(e) {
    e.preventDefault();
    if (!leaveEditId) return;
    try {
      await patchHrLeaveRequest(leaveEditId, leaveEditForm.status);
      notify("ok", "Demande de conge mise a jour.");
      closeLeaveEdit();
      loadLeaves();
    } catch (e) {
      onErr(e);
    }
  }

  const [rForm, setRForm] = useState({
    job_title: "",
    candidate_name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [recruitEditId, setRecruitEditId] = useState(null);
  async function submitRecruitment(e) {
    e.preventDefault();
    try {
      const payload = {
        job_title: rForm.job_title.trim(),
        candidate_name: rForm.candidate_name.trim(),
        email: rForm.email.trim().toLowerCase(),
        phone: rForm.phone.trim() || null,
        notes: rForm.notes.trim() || null,
      };
      if (recruitEditId) {
        await patchHrRecruitment(recruitEditId, payload);
      } else {
        await createHrRecruitment(payload);
      }
      setRForm({ job_title: "", candidate_name: "", email: "", phone: "", notes: "" });
      setRecruitEditId(null);
      notify("ok", recruitEditId ? "Candidat mis a jour." : "Candidat enregistre.");
      loadRecruit();
    } catch (e) {
      onErr(e);
    }
  }

  function startRecruitEdit(row) {
    setRecruitEditId(row.id ?? row._id);
    setRForm({
      job_title: row.job_title || "",
      candidate_name: row.candidate_name || "",
      email: row.email || "",
      phone: row.phone || "",
      notes: row.notes || "",
    });
  }

  async function setRecruitStatus(id, status) {
    try {
      await patchHrRecruitment(id, { status });
      loadRecruit();
    } catch (e) {
      onErr(e);
    }
  }

  async function removeRecruit(id) {
    if (!window.confirm("Supprimer ce dossier de recrutement ?")) return;
    try {
      await deleteHrRecruitment(id);
      notify("ok", "Supprime.");
      loadRecruit();
    } catch (e) {
      onErr(e);
    }
  }

  const [evForm, setEvForm] = useState({
    employee_name: "",
    employee_email: "",
    period_label: "",
    reviewer_name: "",
    score: "4",
    summary: "",
  });
  const [evalEditId, setEvalEditId] = useState(null);
  async function submitEval(e) {
    e.preventDefault();
    try {
      const payload = {
        employee_name: evForm.employee_name.trim(),
        employee_email: evForm.employee_email.trim().toLowerCase(),
        period_label: evForm.period_label.trim(),
        reviewer_name: evForm.reviewer_name.trim(),
        score: evForm.score ? Number(evForm.score) : null,
        summary: evForm.summary.trim() || null,
      };
      if (evalEditId) {
        await patchHrEvaluation(evalEditId, payload);
      } else {
        await createHrEvaluation(payload);
      }
      setEvForm({
        employee_name: "",
        employee_email: "",
        period_label: "",
        reviewer_name: "",
        score: "4",
        summary: "",
      });
      setEvalEditId(null);
      notify("ok", evalEditId ? "Evaluation mise a jour." : "Evaluation creee.");
      loadEvals();
    } catch (e) {
      onErr(e);
    }
  }

  function startEvalEdit(row) {
    setEvalEditId(row.id ?? row._id);
    setEvForm({
      employee_name: row.employee_name || "",
      employee_email: row.employee_email || "",
      period_label: row.period_label || "",
      reviewer_name: row.reviewer_name || "",
      score: row.score != null ? String(row.score) : "",
      summary: row.summary || "",
    });
  }

  async function setEvalStatus(id, status) {
    try {
      await patchHrEvaluation(id, { status });
      loadEvals();
    } catch (e) {
      onErr(e);
    }
  }

  async function removeEval(id) {
    if (!window.confirm("Supprimer cette evaluation ?")) return;
    try {
      await deleteHrEvaluation(id);
      notify("ok", "Supprime.");
      loadEvals();
    } catch (e) {
      onErr(e);
    }
  }

  const [tForm, setTForm] = useState({
    title: "",
    trainer: "",
    location: "",
    start_date: "",
    end_date: "",
    capacity: "20",
    enrolled: "0",
    description: "",
  });
  const [trainingEditId, setTrainingEditId] = useState(null);
  async function submitTraining(e) {
    e.preventDefault();
    try {
      const payload = {
        title: tForm.title.trim(),
        trainer: tForm.trainer.trim(),
        location: tForm.location.trim() || null,
        start_date: tForm.start_date,
        end_date: tForm.end_date,
        capacity: tForm.capacity ? Number(tForm.capacity) : 20,
        enrolled: tForm.enrolled ? Number(tForm.enrolled) : 0,
        description: tForm.description.trim() || null,
      };
      if (trainingEditId) {
        await patchHrTraining(trainingEditId, payload);
      } else {
        await createHrTraining(payload);
      }
      setTForm({
        title: "",
        trainer: "",
        location: "",
        start_date: "",
        end_date: "",
        capacity: "20",
        enrolled: "0",
        description: "",
      });
      setTrainingEditId(null);
      notify("ok", trainingEditId ? "Formation mise a jour." : "Formation planifiee.");
      loadTrainings();
    } catch (e) {
      onErr(e);
    }
  }

  function startTrainingEdit(row) {
    setTrainingEditId(row.id ?? row._id);
    setTForm({
      title: row.title || "",
      trainer: row.trainer || "",
      location: row.location || "",
      start_date: row.start_date ? String(row.start_date).slice(0, 10) : "",
      end_date: row.end_date ? String(row.end_date).slice(0, 10) : "",
      capacity: row.capacity != null ? String(row.capacity) : "20",
      enrolled: row.enrolled != null ? String(row.enrolled) : "0",
      description: row.description || "",
    });
  }

  async function setTrainingStatus(id, status) {
    try {
      await patchHrTraining(id, { status });
      loadTrainings();
    } catch (e) {
      onErr(e);
    }
  }

  async function removeTraining(id) {
    if (!window.confirm("Supprimer cette session ?")) return;
    try {
      await deleteHrTraining(id);
      notify("ok", "Supprime.");
      loadTrainings();
    } catch (e) {
      onErr(e);
    }
  }

  const [cForm, setCForm] = useState({
    employee_name: "",
    employee_email: "",
    current_role: "",
    target_role: "",
    notes: "",
  });
  const [careerEditId, setCareerEditId] = useState(null);
  async function submitCareer(e) {
    e.preventDefault();
    try {
      const payload = {
        employee_name: cForm.employee_name.trim(),
        employee_email: cForm.employee_email.trim().toLowerCase(),
        current_role: cForm.current_role.trim(),
        target_role: cForm.target_role.trim(),
        notes: cForm.notes.trim() || null,
      };
      if (careerEditId) {
        await patchHrCareer(careerEditId, payload);
      } else {
        await createHrCareer({ ...payload, milestones: [] });
      }
      setCForm({ employee_name: "", employee_email: "", current_role: "", target_role: "", notes: "" });
      setCareerEditId(null);
      notify("ok", careerEditId ? "Plan de carriere mis a jour." : "Plan de carriere cree.");
      loadCareers();
    } catch (e) {
      onErr(e);
    }
  }

  function startCareerEdit(plan) {
    setCareerEditId(plan.id ?? plan._id);
    setCForm({
      employee_name: plan.employee_name || "",
      employee_email: plan.employee_email || "",
      current_role: plan.current_role || "",
      target_role: plan.target_role || "",
      notes: plan.notes || "",
    });
  }

  async function setCareerStatus(id, status) {
    try {
      await patchHrCareer(id, { status });
      loadCareers();
    } catch (e) {
      onErr(e);
    }
  }

  async function toggleCareerMilestone(plan, index) {
    const planKey = plan.id ?? plan._id;
    const milestones = [...(plan.milestones || [])];
    if (!milestones[index]) return;
    milestones[index] = { ...milestones[index], done: !milestones[index].done };
    try {
      await patchHrCareer(planKey, { milestones });
      loadCareers();
    } catch (e) {
      onErr(e);
    }
  }

  async function addCareerMilestone(plan) {
    const planKey = plan.id ?? plan._id;
    const draft = milestoneDraft[planKey] || { title: "", due_date: "" };
    if (!draft.title.trim()) {
      notify("err", "Titre du jalon requis.");
      return;
    }
    const milestones = [
      ...(plan.milestones || []),
      { title: draft.title.trim(), due_date: draft.due_date || null, done: false },
    ];
    try {
      await patchHrCareer(planKey, { milestones });
      setMilestoneDraft((s) => ({ ...s, [planKey]: { title: "", due_date: "" } }));
      notify("ok", "Jalon ajoute.");
      loadCareers();
    } catch (e) {
      onErr(e);
    }
  }

  async function removeCareer(id) {
    if (!window.confirm("Supprimer ce plan de carriere ?")) return;
    try {
      await deleteHrCareer(id);
      notify("ok", "Supprime.");
      loadCareers();
    } catch (e) {
      onErr(e);
    }
  }

  function leaveStatusClass(status) {
    const s = status || "EN_ATTENTE";
    if (s === "VALIDE") return "hr-pill hr-pill--ok";
    if (s === "REFUSE") return "hr-pill hr-pill--danger";
    return "hr-pill hr-pill--pending";
  }

  function formatHrDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("fr-FR");
  }

  return (
    <div className="hr-shell">
      {flash.text ? (
        <p className={`hr-flash ${flash.kind === "err" ? "error" : "success"}`}>{flash.text}</p>
      ) : null}

      <section className="card hr-hero">
        <div className="hr-hero-strip">
          <div>
            <p className="hr-hero-eyebrow">Pilotage RH</p>
            <h2 className="hr-hero-title">Espace responsable RH</h2>
            <p className="hr-hero-lede">
              Pilotez les conges, le recrutement, les evaluations, les formations et les carrieres depuis une
              interface unifiee.
            </p>
          </div>
          <button type="button" className="btn-hr-refresh" onClick={refreshAll} disabled={hrRefreshing}>
            <span className="btn-hr-refresh__icon" aria-hidden>
              ↻
            </span>
            {hrRefreshing ? "Chargement…" : "Actualiser tout"}
          </button>
        </div>
        <div className="hr-kpi-grid">
          <button type="button" className="hr-kpi-card" onClick={() => setTab("conges")}>
            <span className="hr-kpi-card__label">Conges en attente</span>
            <span className="hr-kpi-card__value">{kpis.pendingLeaves}</span>
            <span className="hr-kpi-card__hint">A traiter</span>
          </button>
          <button type="button" className="hr-kpi-card hr-kpi-card--violet" onClick={() => setTab("recruitment")}>
            <span className="hr-kpi-card__label">Candidatures actives</span>
            <span className="hr-kpi-card__value">{kpis.activeRecruit}</span>
            <span className="hr-kpi-card__hint">Hors embauche / refus</span>
          </button>
          <button type="button" className="hr-kpi-card hr-kpi-card--amber" onClick={() => setTab("evaluations")}>
            <span className="hr-kpi-card__label">Evaluations planifiees</span>
            <span className="hr-kpi-card__value">{kpis.plannedEvals}</span>
            <span className="hr-kpi-card__hint">Statut planifie</span>
          </button>
          <button type="button" className="hr-kpi-card hr-kpi-card--blue" onClick={() => setTab("trainings")}>
            <span className="hr-kpi-card__label">Sessions a venir / en cours</span>
            <span className="hr-kpi-card__value">{kpis.runningTrainings}</span>
            <span className="hr-kpi-card__hint">Planifie ou en cours</span>
          </button>
          <button type="button" className="hr-kpi-card hr-kpi-card--slate" onClick={() => setTab("careers")}>
            <span className="hr-kpi-card__label">Plans actifs</span>
            <span className="hr-kpi-card__value">{kpis.activeCareers}</span>
            <span className="hr-kpi-card__hint">Carrieres ouvertes</span>
          </button>
          <button type="button" className="hr-kpi-card hr-kpi-card--rose" onClick={() => setTab("infosrh")}>
            <span className="hr-kpi-card__label">Infos RH employes</span>
            <span className="hr-kpi-card__value">{kpis.infoPending}</span>
            <span className="hr-kpi-card__hint">Demandes en attente</span>
          </button>
        </div>
      </section>

      <div className="hr-tab-row" role="tablist" aria-label="Modules RH">
        {allowedTabs.map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={tab === tabId}
            className={hrTabClass(tab === tabId)}
            onClick={() => setTab(tabId)}
          >
            {{
              conges: "Conges",
              recruitment: "Recrutement",
              evaluations: "Evaluations",
              trainings: "Formations",
              careers: "Carrieres",
              infosrh: "Infos RH",
            }[tabId] || tabId}
          </button>
        ))}
      </div>

      {!tabAllowed ? (
        <HrEmptyState title="Acces refuse" message="Vous n avez pas la permission pour ce module." />
      ) : null}

      {canManageHrInfo && infoRequests.length > 0 ? (
        <div className="hr-info-inbox-banner card">
          <div className="hr-info-inbox-banner__text">
            <strong>Demandes employes — Infos RH</strong>
            <p className="muted">
              {kpis.infoPending > 0
                ? `${kpis.infoPending} demande(s) en attente de reponse`
                : `${infoRequests.length} demande(s) au total`}
            </p>
          </div>
          <button type="button" className="btn-primary-solid" onClick={() => setTab("infosrh")}>
            Ouvrir Infos RH
          </button>
        </div>
      ) : null}

      {canManageHrInfo && tab === "infosrh" && tabAllowed ? (
        <div className="hr-info-inbox-hint muted">
          Les messages ci-dessous sont envoyes par les employes depuis leur onglet <strong>Infos RH</strong>.
        </div>
      ) : null}

      {tab === "conges" && tabAllowed && (
        <HrSection
          icon="📅"
          title="Gestion des conges"
          description="Validez ou refusez les demandes soumises par les employes."
          aside={
            <>
              <HrStatChip label="En attente" value={kpis.pendingLeaves} tone="amber" />
              <HrStatChip label="Total" value={leaveRows.length} tone="blue" />
            </>
          }
        >
          <Modal
            open={Boolean(leaveEditId)}
            title="Modifier le statut"
            onClose={closeLeaveEdit}
          >
            <form className="admin-form-grid" onSubmit={submitLeaveEdit}>
              <label>
                Statut
                <select
                  value={leaveEditForm.status}
                  onChange={(e) =>
                    setLeaveEditForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  required
                >
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="VALIDE">Valide</option>
                  <option value="REFUSE">Refuse</option>
                </select>
              </label>
              <FormModalActions onCancel={closeLeaveEdit} submitLabel="Enregistrer" />
            </form>
          </Modal>

          {leaveRows.length === 0 ? (
            <HrEmptyState title="Aucune demande" message="Les demandes de conge des employes apparaitront ici." />
          ) : (
            <ul className="hr-leave-list">
              {leaveRows.map((r, idx) => {
                const id = r.id ?? r._id;
                const st = r.status || "EN_ATTENTE";
                const pending = st === "EN_ATTENTE";
                return (
                  <li key={rowId(r) || `leave-${idx}`} className="hr-leave-item">
                    <div className="hr-leave-item__main">
                      <strong>{r.employee_name}</strong>
                      <span className="muted">{r.employee_email}</span>
                      <span className="muted">
                        {LEAVE_TYPE_LABEL[r.leave_type] || r.leave_type} · {formatHrDate(r.from)} →{" "}
                        {formatHrDate(r.to)}
                      </span>
                    </div>
                    <div className="hr-leave-item__actions admin-row-actions">
                      <span className={leaveStatusClass(st)}>{LEAVE_STATUS_LABEL[st] || st}</span>
                      {pending ? (
                        <>
                          <button type="button" className="btn-primary-solid" onClick={() => updateLeave(id, "VALIDE")}>
                            Valider
                          </button>
                          <DangerRowButton onClick={() => updateLeave(id, "REFUSE")}>Refuser</DangerRowButton>
                        </>
                      ) : (
                        <EditRowButton onClick={() => openLeaveEdit(id, st)} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </HrSection>
      )}

      {tab === "recruitment" && tabAllowed && (
        <HrSection
          icon="🎯"
          title="Recrutement"
          description="Suivi des candidatures : poste, contact et avancement du processus."
          aside={<HrStatChip label="Actives" value={kpis.activeRecruit} tone="violet" />}
        >
          <div className="hr-form-panel">
            <HrSubpanelTitle>{recruitEditId ? "Modifier le candidat" : "Nouveau candidat"}</HrSubpanelTitle>
          <form className="hr-form" onSubmit={submitRecruitment}>
            <div className="hr-form-grid">
              <div>
                <label>Intitule du poste</label>
                <input
                  value={rForm.job_title}
                  onChange={(e) => setRForm((s) => ({ ...s, job_title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Nom du candidat</label>
                <input
                  value={rForm.candidate_name}
                  onChange={(e) => setRForm((s) => ({ ...s, candidate_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={rForm.email}
                  onChange={(e) => setRForm((s) => ({ ...s, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Telephone</label>
                <input
                  value={rForm.phone}
                  onChange={(e) => setRForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="Optionnel"
                />
              </div>
            </div>
            <div>
              <label>Notes internes</label>
              <textarea value={rForm.notes} onChange={(e) => setRForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
            <FormModalActions
              showCancel={Boolean(recruitEditId)}
              onCancel={() => {
                setRecruitEditId(null);
                setRForm({ job_title: "", candidate_name: "", email: "", phone: "", notes: "" });
              }}
              submitLabel={recruitEditId ? "Enregistrer" : "Ajouter le candidat"}
            />
          </form>
          </div>

          <HrSubpanelTitle>Dossiers de recrutement</HrSubpanelTitle>
          {recruit.length === 0 ? (
            <HrEmptyState title="Aucun candidat" message="Ajoutez un dossier de recrutement avec le formulaire ci-dessus." />
          ) : (
            <div className="hr-recruit-grid">
              {recruit.map((row, idx) => (
                <article key={rowId(row) || `recruit-${idx}`} className="hr-recruit-card">
                  <div className="hr-recruit-card__head">
                    <div>
                      <h4 className="hr-recruit-card__title">{row.job_title}</h4>
                      <p className="muted">{row.candidate_name}</p>
                    </div>
                  </div>
                  <p className="muted">
                    {row.email}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  <label>
                    Etape du processus
                    <select
                      value={row.status || "NOUVEAU"}
                      onChange={(e) => setRecruitStatus(row.id ?? row._id, e.target.value)}
                      aria-label={`Statut pour ${row.candidate_name}`}
                    >
                      {RECRUIT_STATUS.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="hr-recruit-card__actions">
                    <EditRowButton onClick={() => startRecruitEdit(row)} />
                    <DangerRowButton onClick={() => removeRecruit(row.id ?? row._id)} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </HrSection>
      )}

      {tab === "evaluations" && tabAllowed && (
        <HrSection
          icon="⭐"
          title="Evaluations"
          description="Planifiez et cloturez les entretiens annuels ou de performance."
          aside={<HrStatChip label="Planifiees" value={kpis.plannedEvals} tone="amber" />}
        >
          <div className="hr-form-panel">
            <HrSubpanelTitle>{evalEditId ? "Modifier l evaluation" : "Nouvelle evaluation"}</HrSubpanelTitle>
          <form className="hr-form" onSubmit={submitEval}>
            <div className="hr-form-grid">
              <div>
                <label>Employe (nom)</label>
                <input
                  value={evForm.employee_name}
                  onChange={(e) => setEvForm((s) => ({ ...s, employee_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Employe (email)</label>
                <input
                  type="email"
                  value={evForm.employee_email}
                  onChange={(e) => setEvForm((s) => ({ ...s, employee_email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Periode</label>
                <input
                  value={evForm.period_label}
                  onChange={(e) => setEvForm((s) => ({ ...s, period_label: e.target.value }))}
                  placeholder="ex. 2026 - S1"
                  required
                />
              </div>
              <div>
                <label>Evaluateur</label>
                <input
                  value={evForm.reviewer_name}
                  onChange={(e) => setEvForm((s) => ({ ...s, reviewer_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Note (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={evForm.score}
                  onChange={(e) => setEvForm((s) => ({ ...s, score: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label>Synthese</label>
              <textarea value={evForm.summary} onChange={(e) => setEvForm((s) => ({ ...s, summary: e.target.value }))} />
            </div>
            <FormModalActions
              showCancel={Boolean(evalEditId)}
              onCancel={() => {
                setEvalEditId(null);
                setEvForm({
                  employee_name: "",
                  employee_email: "",
                  period_label: "",
                  reviewer_name: "",
                  score: "4",
                  summary: "",
                });
              }}
              submitLabel={evalEditId ? "Enregistrer" : "Planifier une evaluation"}
            />
          </form>
          </div>

          <HrSubpanelTitle>Liste des evaluations</HrSubpanelTitle>
          <div className="hr-table-panel">
          <div className="hr-table-wrap">
            <table className="data-table hr-data-table">
              <thead>
                <tr>
                  <th>Employe</th>
                  <th>Periode</th>
                  <th>Evaluateur</th>
                  <th>Note</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {evals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="hr-table-empty">
                      Aucune evaluation enregistree.
                    </td>
                  </tr>
                ) : (
                  evals.map((row, idx) => (
                    <tr key={rowId(row) || `eval-${idx}`}>
                      <td>
                        <div>{row.employee_name}</div>
                        <small className="muted">{row.employee_email}</small>
                      </td>
                      <td>{row.period_label}</td>
                      <td>{row.reviewer_name}</td>
                      <td>{row.score != null ? `${row.score} / 5` : "—"}</td>
                      <td>
                        <select
                          value={row.status || "PLANIFIE"}
                          onChange={(e) => setEvalStatus(row.id ?? row._id, e.target.value)}
                          aria-label={`Statut evaluation ${row.employee_name}`}
                        >
                          {EVAL_STATUS.map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="actions admin-row-actions">
                        <EditRowButton onClick={() => startEvalEdit(row)} />
                        <DangerRowButton onClick={() => removeEval(row.id ?? row._id)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </HrSection>
      )}

      {tab === "trainings" && tabAllowed && (
        <HrSection
          icon="🎓"
          title="Formations"
          description="Sessions internes ou externes : dates, capacite et suivi des inscrits."
          aside={<HrStatChip label="Sessions actives" value={kpis.runningTrainings} tone="blue" />}
        >
          <div className="hr-form-panel">
            <HrSubpanelTitle>{trainingEditId ? "Modifier la session" : "Nouvelle session"}</HrSubpanelTitle>
          <form className="hr-form" onSubmit={submitTraining}>
            <div className="hr-form-grid">
              <div>
                <label>Titre</label>
                <input value={tForm.title} onChange={(e) => setTForm((s) => ({ ...s, title: e.target.value }))} required />
              </div>
              <div>
                <label>Formateur / organisme</label>
                <input
                  value={tForm.trainer}
                  onChange={(e) => setTForm((s) => ({ ...s, trainer: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Lieu</label>
                <input value={tForm.location} onChange={(e) => setTForm((s) => ({ ...s, location: e.target.value }))} />
              </div>
              <div>
                <label>Date debut</label>
                <input
                  type="date"
                  value={tForm.start_date}
                  onChange={(e) => setTForm((s) => ({ ...s, start_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Date fin</label>
                <input
                  type="date"
                  value={tForm.end_date}
                  onChange={(e) => setTForm((s) => ({ ...s, end_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Capacite</label>
                <input
                  type="number"
                  min={1}
                  value={tForm.capacity}
                  onChange={(e) => setTForm((s) => ({ ...s, capacity: e.target.value }))}
                />
              </div>
              <div>
                <label>Inscrits</label>
                <input
                  type="number"
                  min={0}
                  value={tForm.enrolled}
                  onChange={(e) => setTForm((s) => ({ ...s, enrolled: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label>Description</label>
              <textarea
                value={tForm.description}
                onChange={(e) => setTForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <FormModalActions
              showCancel={Boolean(trainingEditId)}
              onCancel={() => {
                setTrainingEditId(null);
                setTForm({
                  title: "",
                  trainer: "",
                  location: "",
                  start_date: "",
                  end_date: "",
                  capacity: "20",
                  enrolled: "0",
                  description: "",
                });
              }}
              submitLabel={trainingEditId ? "Enregistrer" : "Ajouter la formation"}
            />
          </form>
          </div>

          <HrSubpanelTitle>Sessions planifiees</HrSubpanelTitle>
          <div className="hr-table-panel">
          <div className="hr-table-wrap">
            <table className="data-table hr-data-table">
              <thead>
                <tr>
                  <th>Formation</th>
                  <th>Periode</th>
                  <th>Places</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trainings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="hr-table-empty">
                      Aucune session planifiee.
                    </td>
                  </tr>
                ) : (
                  trainings.map((row, idx) => (
                    <tr key={rowId(row) || `train-${idx}`}>
                      <td>
                        <div>{row.title}</div>
                        <small className="muted">{row.trainer}</small>
                        {row.location ? <div className="muted">{row.location}</div> : null}
                      </td>
                      <td>
                        {formatHrDate(row.start_date)} → {formatHrDate(row.end_date)}
                      </td>
                      <td>
                        {row.enrolled ?? 0} / {row.capacity ?? "—"}
                      </td>
                      <td>
                        <select
                          value={row.status || "PLANIFIE"}
                          onChange={(e) => setTrainingStatus(row.id ?? row._id, e.target.value)}
                          aria-label={`Statut formation ${row.title}`}
                        >
                          {TRAIN_STATUS.map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="actions admin-row-actions">
                        <EditRowButton onClick={() => startTrainingEdit(row)} />
                        <DangerRowButton onClick={() => removeTraining(row.id ?? row._id)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </HrSection>
      )}

      {tab === "careers" && tabAllowed && (
        <HrSection
          icon="📈"
          title="Carrieres"
          description="Plans d evolution : poste actuel, cible et jalons de progression."
          aside={<HrStatChip label="Plans actifs" value={kpis.activeCareers} tone="slate" />}
        >
          <div className="hr-form-panel">
            <HrSubpanelTitle>{careerEditId ? "Modifier le plan" : "Nouveau plan de carriere"}</HrSubpanelTitle>
          <form className="hr-form" onSubmit={submitCareer}>
            <div className="hr-form-grid">
              <div>
                <label>Employe (nom)</label>
                <input
                  value={cForm.employee_name}
                  onChange={(e) => setCForm((s) => ({ ...s, employee_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Employe (email)</label>
                <input
                  type="email"
                  value={cForm.employee_email}
                  onChange={(e) => setCForm((s) => ({ ...s, employee_email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Poste actuel</label>
                <input
                  value={cForm.current_role}
                  onChange={(e) => setCForm((s) => ({ ...s, current_role: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Poste vise</label>
                <input
                  value={cForm.target_role}
                  onChange={(e) => setCForm((s) => ({ ...s, target_role: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label>Notes</label>
              <textarea value={cForm.notes} onChange={(e) => setCForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
            <FormModalActions
              showCancel={Boolean(careerEditId)}
              onCancel={() => {
                setCareerEditId(null);
                setCForm({ employee_name: "", employee_email: "", current_role: "", target_role: "", notes: "" });
              }}
              submitLabel={careerEditId ? "Enregistrer" : "Creer un plan de carriere"}
            />
          </form>
          </div>

          <HrSubpanelTitle>Plans de carriere</HrSubpanelTitle>
          <div className="hr-career-list">
            {careers.length === 0 ? (
              <HrEmptyState title="Aucun plan" message="Creez un plan de carriere avec le formulaire ci-dessus." />
            ) : null}
            {careers.map((plan) => {
              const planKey = plan.id ?? plan._id;
              return (
              <article key={planKey} className="hr-career-card">
                <header className="hr-career-card__head">
                  <div>
                    <strong>{plan.employee_name}</strong>
                    <div className="muted">{plan.employee_email}</div>
                    <p className="hr-career-path">
                      {plan.current_role} <span aria-hidden>→</span> {plan.target_role}
                    </p>
                  </div>
                  <div className="hr-career-card__actions">
                    <EditRowButton onClick={() => startCareerEdit(plan)} />
                    <select
                      value={plan.status || "ACTIF"}
                      onChange={(e) => setCareerStatus(planKey, e.target.value)}
                      aria-label={`Statut plan ${plan.employee_name}`}
                    >
                      {CAREER_STATUS.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <DangerRowButton onClick={() => removeCareer(planKey)} />
                  </div>
                </header>
                {plan.notes ? <p className="muted">{plan.notes}</p> : null}
                <h4 className="hr-milestones-title">Jalons</h4>
                <ul className="hr-milestones">
                  {(plan.milestones || []).map((m, i) => (
                    <li key={`${planKey}-m-${i}`}>
                      <label className="hr-milestone-row">
                        <input
                          type="checkbox"
                          checked={!!m.done}
                          onChange={() => toggleCareerMilestone(plan, i)}
                        />
                        <span>
                          {m.title}
                          {m.due_date ? <small className="muted"> — echeance {m.due_date}</small> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="hr-add-milestone">
                  <input
                    placeholder="Nouveau jalon"
                    value={(milestoneDraft[planKey] || {}).title || ""}
                    onChange={(e) =>
                      setMilestoneDraft((s) => ({
                        ...s,
                        [planKey]: { ...(s[planKey] || {}), title: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="date"
                    value={(milestoneDraft[planKey] || {}).due_date || ""}
                    onChange={(e) =>
                      setMilestoneDraft((s) => ({
                        ...s,
                        [planKey]: { ...(s[planKey] || {}), due_date: e.target.value },
                      }))
                    }
                  />
                  <button type="button" onClick={() => addCareerMilestone(plan)}>
                    Ajouter le jalon
                  </button>
                </div>
                {(plan.milestones || []).length === 0 ? <p className="muted">Aucun jalon pour le moment.</p> : null}
              </article>
            );
            })}
          </div>
        </HrSection>
      )}

      {tab === "infosrh" && tabAllowed && (
        <HrInfoRequestsSection
          items={infoRequests}
          onRefresh={loadInfoRequests}
          notify={notify}
          onError={onErr}
        />
      )}
    </div>
  );
}

