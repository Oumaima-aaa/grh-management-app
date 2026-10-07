import { useEffect, useMemo, useRef, useState } from "react";
import { updateRoleProfile } from "../api";
import { AdminPanel } from "./components/ui";

const ROLE_DESCRIPTIONS = {
  admin: "Administration globale de la plateforme",
  rh: "Pilotage operationnel RH",
  employe: "Acces collaborateur",
};

const DEFAULT_RESPONSIBILITIES = {
  admin: [
    "Gerer les utilisateurs",
    "Gerer les roles",
    "Configurer les parametres systeme",
    "Consulter les journaux d activite",
    "Superviser les donnees RH en consultation",
  ],
  rh: [
    "Gerer les employes",
    "Approuver les conges",
    "Gerer le recrutement",
    "Gerer les evaluations",
    "Gerer les formations",
    "Gerer les carrieres",
    "Traiter les demandes d informations RH",
  ],
  employe: [
    "Consulter son profil",
    "Demander un conge",
    "Demander des informations RH",
    "Participer aux evaluations",
    "S inscrire aux formations",
    "Consulter son plan de carriere",
  ],
};

function isTechnicalPermissionKey(value) {
  const s = String(value || "").trim();
  return /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$/i.test(s);
}

export function naturalResponsibilities(items) {
  return (items || []).filter(
    (item) => typeof item === "string" && item.trim() && !isTechnicalPermissionKey(item)
  );
}

export function normalizeRoleRow(row) {
  const merged = [
    ...(row.responsibilities || []),
    ...(row.permissions || []).filter((p) => !isTechnicalPermissionKey(p)),
  ];
  return {
    ...row,
    description: row.description || ROLE_DESCRIPTIONS[row.role] || "",
    responsibilities: Array.from(new Set(naturalResponsibilities(merged))),
    permissions: [],
  };
}

export function mergeDefaultRoles(matrix) {
  const defaults = ["admin", "rh", "employe"];
  const out = [...(matrix || [])].map(normalizeRoleRow);
  defaults.forEach((role) => {
    if (!out.some((r) => r.role === role)) {
      out.push({
        role,
        description: ROLE_DESCRIPTIONS[role] || "",
        responsibilities: [...(DEFAULT_RESPONSIBILITIES[role] || [])],
        permissions: [],
      });
    }
  });
  return out;
}

function roleLabel(role) {
  return (role || "").replace(/_/g, " ").trim() || "role";
}

export function RolesSection({
  roleMatrix,
  setRoleMatrix,
  focusRole = null,
  onGoToUsers,
  setFlash,
  setError,
  onSaved,
}) {
  const [newRoleName, setNewRoleName] = useState("");
  const [editRespRole, setEditRespRole] = useState(null);
  const [editMetaRole, setEditMetaRole] = useState(null);
  const [metaDraft, setMetaDraft] = useState({ description: "" });
  const [respBackup, setRespBackup] = useState(null);
  const [metaBackup, setMetaBackup] = useState(null);
  const [saving, setSaving] = useState(null);
  const [lineEdit, setLineEdit] = useState(null);
  const [lineEditValue, setLineEditValue] = useState("");
  const cardRefs = useRef({});

  const roleMap = useMemo(() => {
    const m = {};
    (roleMatrix || []).forEach((r) => {
      m[r.role] = { ...normalizeRoleRow(r) };
    });
    return m;
  }, [roleMatrix]);

  const availableRoles = useMemo(() => {
    const defaults = ["admin", "rh", "employe"];
    const dynamic = (roleMatrix || []).map((r) => r.role).filter(Boolean);
    return Array.from(new Set([...defaults, ...dynamic]));
  }, [roleMatrix]);

  useEffect(() => {
    if (!focusRole) return;
    const el = cardRefs.current[focusRole];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusRole]);

  function ensureRoleRow(role) {
    const existing = roleMatrix.find((r) => r.role === role);
    if (existing) return existing;
    const row = {
      role,
      description: ROLE_DESCRIPTIONS[role] || "",
      responsibilities: [...(DEFAULT_RESPONSIBILITIES[role] || [])],
      permissions: [],
    };
    setRoleMatrix((prev) => [...prev, row]);
    return row;
  }

  function updateDraftRole(role, updater) {
    setRoleMatrix((prev) => {
      const exists = prev.some((row) => row.role === role);
      if (!exists) {
        const base = {
          role,
          description: ROLE_DESCRIPTIONS[role] || "",
          responsibilities: [...(DEFAULT_RESPONSIBILITIES[role] || [])],
          permissions: [],
        };
        return [...prev, { ...base, ...updater(base) }];
      }
      return prev.map((row) => (row.role === role ? { ...row, ...updater(row) } : row));
    });
  }

  function startEditResponsibilities(role) {
    setEditMetaRole(null);
    const row = ensureRoleRow(role);
    setRespBackup({ ...row, responsibilities: [...(row.responsibilities || [])] });
    setEditRespRole(role);
    setLineEdit(null);
  }

  function cancelEditResponsibilities(role) {
    if (respBackup && respBackup.role === role) {
      setRoleMatrix((prev) => prev.map((r) => (r.role === role ? { ...respBackup } : r)));
    }
    setEditRespRole(null);
    setRespBackup(null);
    setLineEdit(null);
  }

  function startEditMeta(role) {
    setEditRespRole(null);
    const row = ensureRoleRow(role);
    setMetaBackup({ description: row.description || "" });
    setMetaDraft({ description: row.description || ROLE_DESCRIPTIONS[role] || "" });
    setEditMetaRole(role);
  }

  function cancelEditMeta(role) {
    if (metaBackup) {
      updateDraftRole(role, () => ({ description: metaBackup.description }));
    }
    setEditMetaRole(null);
    setMetaBackup(null);
  }

  async function saveResponsibilities(role) {
    const row = roleMatrix.find((r) => r.role === role) || ensureRoleRow(role);
    const toSave = naturalResponsibilities(row.responsibilities);
    setSaving(`resp-${role}`);
    setError("");
    try {
      await updateRoleProfile(role, {
        responsibilities: toSave,
        permissions: [],
        description: row.description || "",
      });
      setFlash(`Responsabilites de ${roleLabel(role)} enregistrees.`);
      setEditRespRole(null);
      setRespBackup(null);
      setLineEdit(null);
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function saveMeta(role) {
    const row = roleMatrix.find((r) => r.role === role) || ensureRoleRow(role);
    setSaving(`meta-${role}`);
    setError("");
    try {
      await updateRoleProfile(role, {
        responsibilities: naturalResponsibilities(row.responsibilities),
        permissions: [],
        description: metaDraft.description.trim(),
      });
      updateDraftRole(role, () => ({ description: metaDraft.description.trim() }));
      setFlash(`Profil du role ${roleLabel(role)} enregistre.`);
      setEditMetaRole(null);
      setMetaBackup(null);
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminPanel
      title="Roles & responsabilites"
      desc="Modifiez le profil de chaque role et ses responsabilites avec les boutons dedies"
    >
      <div className="role-quick-actions">
        <button type="button" className="btn-ghost-sm" onClick={() => onGoToUsers?.()}>
          Assigner un role aux utilisateurs
        </button>
      </div>

      <form
        className="admin-form-inline"
        onSubmit={(e) => {
          e.preventDefault();
          const role = newRoleName.trim().toLowerCase();
          if (!role) return;
          if (roleMap[role]) {
            setError("Ce role existe deja.");
            return;
          }
          setRoleMatrix((prev) => [
            ...prev,
            {
              role,
              description: "",
              responsibilities: [...(DEFAULT_RESPONSIBILITIES[role] || [])],
              permissions: [],
            },
          ]);
          setNewRoleName("");
          setFlash(`Role ${role} ajoute. Cliquez sur Modifier pour le configurer.`);
          startEditResponsibilities(role);
        }}
      >
        <input
          placeholder="Nouveau role (ex: manager)"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
        />
        <button type="submit" className="btn-primary-solid">
          Ajouter un role
        </button>
      </form>

      <div className="role-cards">
        {availableRoles.map((role) => {
          const draft = roleMap[role] || normalizeRoleRow({ role, responsibilities: [], permissions: [] });
          const savedList = naturalResponsibilities(draft.responsibilities);
          const editingResp = editRespRole === role;
          const editingMeta = editMetaRole === role;
          const isSavingResp = saving === `resp-${role}`;
          const isSavingMeta = saving === `meta-${role}`;

          return (
            <div
              key={role}
              ref={(el) => {
                cardRefs.current[role] = el;
              }}
              className={`role-card${editingResp || editingMeta ? " role-card--editing" : ""}${focusRole === role ? " role-card--focus" : ""}`}
            >
              <div className="role-card__header">
                <div>
                  <span className={`role-pill ${role}`}>{roleLabel(role)}</span>
                  <p className="role-card__description">{draft.description || "Aucune description"}</p>
                </div>
                <span className="admin-chip-meta">{savedList.length} responsabilite(s)</span>
              </div>

              <div className="role-card__buttons">
                {!editingResp && !editingMeta ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => startEditResponsibilities(role)}
                    >
                      Modifier les responsabilites
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => startEditMeta(role)}
                    >
                      Modifier le role
                    </button>
                  </>
                ) : null}
              </div>

              {editingMeta ? (
                <div className="role-edit-panel">
                  <h4>Modifier le role : {roleLabel(role)}</h4>
                  <label>
                    Description du role
                    <textarea
                      rows={3}
                      value={metaDraft.description}
                      onChange={(e) => setMetaDraft({ description: e.target.value })}
                      placeholder="Ex. Pilotage operationnel des ressources humaines"
                    />
                  </label>
                  <div className="role-card__toolbar form-actions-bar">
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      disabled={isSavingMeta}
                      onClick={() => cancelEditMeta(role)}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn-primary-solid"
                      disabled={isSavingMeta}
                      onClick={() => saveMeta(role)}
                    >
                      {isSavingMeta ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </div>
              ) : null}

              {editingResp ? (
                <div className="role-edit-panel">
                  <h4>Modifier les responsabilites</h4>
                  <label>
                    Liste (une responsabilite par ligne)
                    <textarea
                      rows={8}
                      value={(draft.responsibilities || []).join("\n")}
                      onChange={(e) =>
                        updateDraftRole(role, () => ({
                          responsibilities: String(e.target.value || "").split(/\r?\n/).map((v) => v.trimEnd()),
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() =>
                      updateDraftRole(role, (row) => ({
                        responsibilities: [...(row.responsibilities || []), ""],
                      }))
                    }
                  >
                    + Ajouter une responsabilite
                  </button>

                  <ul className="role-responsibility-list role-responsibility-list--edit">
                    {naturalResponsibilities(draft.responsibilities).map((item, index) => (
                      <li key={`${role}-line-${index}`}>
                        {lineEdit?.role === role && lineEdit.index === index ? (
                          <>
                            <input
                              className="role-line-input"
                              value={lineEditValue}
                              onChange={(e) => setLineEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const list = naturalResponsibilities(draft.responsibilities);
                                  list[index] = lineEditValue.trim();
                                  updateDraftRole(role, () => ({ responsibilities: list }));
                                  setLineEdit(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn-ghost-sm role-item-btn"
                              onClick={() => {
                                const list = naturalResponsibilities(draft.responsibilities);
                                list[index] = lineEditValue.trim();
                                updateDraftRole(role, () => ({ responsibilities: list }));
                                setLineEdit(null);
                              }}
                            >
                              OK
                            </button>
                          </>
                        ) : (
                          <span className="role-responsibility-list__text">{item}</span>
                        )}
                        <div className="role-line-actions">
                          <button
                            type="button"
                            className="btn-secondary-sm role-item-btn"
                            onClick={() => {
                              setLineEdit({ role, index });
                              setLineEditValue(item);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-sm role-item-btn role-item-btn--danger"
                            onClick={() => {
                              const list = naturalResponsibilities(draft.responsibilities);
                              updateDraftRole(role, () => ({
                                responsibilities: list.filter((_, i) => i !== index),
                              }));
                              setLineEdit(null);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="role-card__toolbar form-actions-bar">
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      disabled={isSavingResp}
                      onClick={() => cancelEditResponsibilities(role)}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn-primary-solid"
                      disabled={isSavingResp}
                      onClick={() => saveResponsibilities(role)}
                    >
                      {isSavingResp ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="role-view-panel">
                  <h4>Responsabilites enregistrees</h4>
                  {savedList.length > 0 ? (
                    <ul className="role-responsibility-list role-responsibility-list--view">
                      {savedList.map((item, index) => (
                        <li key={`${role}-view-${index}`}>
                          <span className="role-responsibility-list__text">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Aucune responsabilite. Cliquez sur Modifier les responsabilites.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminPanel>
  );
}
