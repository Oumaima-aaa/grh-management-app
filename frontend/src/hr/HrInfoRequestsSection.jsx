import { useMemo, useState } from "react";
import { patchHrInfoRequest } from "../api";
import { FormModalActions, Modal } from "../admin/components/ui";
import { HrEmptyState, HrSection, HrStatChip, HrSubpanelTitle } from "./hrUi";

const INFO_STATUS_LABEL = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TRAITEE: "Traitee",
  FERMEE: "Fermee",
};

function infoPillClass(status) {
  const map = {
    EN_ATTENTE: "hr-pill hr-pill--pending",
    EN_COURS: "hr-pill hr-pill--progress",
    TRAITEE: "hr-pill hr-pill--ok",
    FERMEE: "hr-pill hr-pill--neutral",
  };
  return map[status] || "hr-pill";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("fr-FR");
}

export function HrInfoRequestsSection({ items, onRefresh, notify, onError }) {
  const [filter, setFilter] = useState("");
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ status: "EN_ATTENTE", response: "" });
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const list = items || [];
    return {
      total: list.length,
      pending: list.filter((r) => (r.status || "EN_ATTENTE") === "EN_ATTENTE").length,
      inProgress: list.filter((r) => r.status === "EN_COURS").length,
      done: list.filter((r) => ["TRAITEE", "FERMEE"].includes(r.status)).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const list = items || [];
    if (!filter) return list;
    if (filter === "pending") return list.filter((r) => (r.status || "EN_ATTENTE") === "EN_ATTENTE");
    if (filter === "progress") return list.filter((r) => r.status === "EN_COURS");
    if (filter === "done") return list.filter((r) => ["TRAITEE", "FERMEE"].includes(r.status));
    return list;
  }, [items, filter]);

  const editing = (items || []).find((r) => r.id === editId);

  function openEdit(row) {
    setEditId(row.id);
    setDraft({
      status: row.status || "EN_ATTENTE",
      response: row.response || "",
    });
  }

  function closeEdit() {
    setEditId(null);
    setDraft({ status: "EN_ATTENTE", response: "" });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await patchHrInfoRequest(editId, draft);
      notify("ok", "Reponse enregistree et envoyee a l employe.");
      closeEdit();
      onRefresh();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <HrSection
        icon="💬"
        title="Informations RH des employes"
        description="Demandes envoyees par les collaborateurs depuis leur espace : attestations, questions paie, procedures, etc."
        aside={
          <>
            <HrStatChip label="Total" value={counts.total} tone="blue" />
            <HrStatChip label="En attente" value={counts.pending} tone="amber" />
            <HrStatChip label="En cours" value={counts.inProgress} tone="violet" />
            <HrStatChip label="Traitees" value={counts.done} tone="slate" />
          </>
        }
      >
        <div className="hr-info-filters" role="tablist" aria-label="Filtrer les demandes">
          {[
            ["", "Toutes", counts.total],
            ["pending", "En attente", counts.pending],
            ["progress", "En cours", counts.inProgress],
            ["done", "Traitees", counts.done],
          ].map(([key, label, count]) => (
            <button
              key={key || "all"}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`hr-info-filter${filter === key ? " hr-info-filter--active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="hr-info-filter__count">{count}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <HrEmptyState
            title="Aucune demande"
            message={
              filter
                ? "Aucune demande dans cette categorie."
                : "Les employes peuvent envoyer une demande depuis l onglet Infos RH de leur espace."
            }
          />
        ) : (
          <ul className="hr-info-list hr-info-list--rich">
            {filtered.map((row) => (
              <li key={row.id} className="hr-info-card hr-info-card--inbox">
                <div className="hr-info-card__head">
                  <div className="hr-info-card__from">
                    <span className="hr-info-card__avatar" aria-hidden>
                      {(row.employee_name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{row.subject}</strong>
                      <p className="hr-info-card__meta muted">
                        {row.employee_name} · {row.employee_email}
                      </p>
                      <p className="hr-info-card__date muted">Recue le {formatDate(row.created_at)}</p>
                    </div>
                  </div>
                  <span className={infoPillClass(row.status)}>
                    {INFO_STATUS_LABEL[row.status] || row.status}
                  </span>
                </div>

                <div className="hr-info-card__message">
                  <span className="hr-info-card__label">Message employe</span>
                  <p>{row.message}</p>
                </div>

                {row.response ? (
                  <div className="hr-info-card__reply">
                    <span className="hr-info-card__label">Votre reponse</span>
                    <p>{row.response}</p>
                  </div>
                ) : (
                  <p className="hr-info-card__noreply muted">Pas encore de reponse RH.</p>
                )}

                <div className="hr-info-card__foot">
                  <button type="button" className="btn-secondary-sm" onClick={() => openEdit(row)}>
                    {row.response ? "Modifier la reponse" : "Repondre"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HrSection>

      <Modal
        open={Boolean(editId)}
        title={editing ? `Reponse — ${editing.employee_name}` : "Reponse RH"}
        onClose={closeEdit}
        wide
      >
        {editing ? (
          <form className="admin-form-grid" onSubmit={saveEdit}>
            <div className="admin-form-span2 hr-info-modal-preview">
              <HrSubpanelTitle>Demande de l employe</HrSubpanelTitle>
              <p>
                <strong>{editing.subject}</strong>
              </p>
              <p className="muted">{editing.message}</p>
            </div>
            <label>
              Statut
              <select
                value={draft.status}
                onChange={(e) => setDraft((s) => ({ ...s, status: e.target.value }))}
                required
              >
                <option value="EN_ATTENTE">En attente</option>
                <option value="EN_COURS">En cours de traitement</option>
                <option value="TRAITEE">Traitee (reponse envoyee)</option>
                <option value="FERMEE">Fermee</option>
              </select>
            </label>
            <label className="admin-form-span2">
              Reponse RH (visible par l employe)
              <textarea
                rows={5}
                value={draft.response}
                onChange={(e) => setDraft((s) => ({ ...s, response: e.target.value }))}
                placeholder="Redigez votre reponse ici..."
                required
              />
            </label>
            <FormModalActions
              onCancel={closeEdit}
              submitLabel="Enregistrer"
              submitDisabled={saving}
            />
          </form>
        ) : null}
      </Modal>
    </>
  );
}
