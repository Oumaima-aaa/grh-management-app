import { useCallback, useEffect, useState } from "react";
import { getHrEmployees, patchHrEmployeeProfile } from "../api";
import { UserPermissionsModal } from "../admin/UserPermissionsModal";
import {
  AdminPanel,
  DataTable,
  EditRowButton,
  FormModalActions,
  Modal,
  Pagination,
  SearchInput,
  usePagedFilter,
  fmtDate,
} from "../admin/components/ui";

export function HrEmployeesSection({ setFlash, setError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permUser, setPermUser] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    matricule: "",
    poste: "",
    service: "",
    salaire: "",
    hire_date: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
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
    searchKeys: ["name", "email", "matricule", "poste"],
    pageSize: 10,
  });

  function openEdit(emp) {
    setDetail(emp);
    setForm({
      matricule: emp.matricule || "",
      poste: emp.poste || "",
      service: emp.service || "",
      salaire: emp.salaire ?? "",
      hire_date: emp.hire_date ? String(emp.hire_date).slice(0, 10) : "",
    });
  }

  async function save(e) {
    e.preventDefault();
    if (!detail) return;
    setError("");
    try {
      await patchHrEmployeeProfile(detail.id, {
        matricule: form.matricule.trim(),
        poste: form.poste.trim(),
        service: form.service.trim(),
        salaire: form.salaire ? Number(form.salaire) : null,
        hire_date: form.hire_date || null,
      });
      setFlash("Fiche employe mise a jour.");
      setDetail(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "matricule", label: "Matricule" },
    { key: "name", label: "Nom" },
    { key: "email", label: "Email" },
    { key: "poste", label: "Poste" },
    {
      label: "Modules (compte)",
      render: (r) => (
        <div className="admin-user-perm-cell">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() =>
              setPermUser({
                id: r.id,
                name: r.name,
                email: r.email,
                role: r.role || "employe",
              })
            }
          >
            Permissions
          </button>
          <span className="muted admin-perm-count">
            {(r.permissions || []).length
              ? `${r.permissions.length} module(s)`
              : "Profil seul par defaut"}
          </span>
        </div>
      ),
    },
    { key: "hire_date", label: "Embauche", render: (r) => fmtDate(r.hire_date) },
    {
      label: "",
      render: (r) => (
        <div className="admin-row-actions">
          <EditRowButton onClick={() => openEdit(r)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPanel
        title="Gestion des employes"
        desc="Fiches professionnelles et modules visibles par compte (chaque employe a ses propres permissions)."
        actions={
          <button type="button" className="btn-ghost-sm" onClick={load} disabled={loading}>
            Actualiser
          </button>
        }
      >
        <div className="admin-toolbar">
          <SearchInput
            value={pager.q}
            onChange={(v) => {
              pager.setQ(v);
              pager.setPage(1);
            }}
            placeholder="Nom, email, matricule, poste…"
          />
        </div>
        <p className="muted admin-perm-hint" style={{ marginBottom: 12 }}>
          Utilisez <strong>Permissions</strong> pour definir ce que chaque employe voit a la connexion (ex. profil
          uniquement pour Oumaima). Les autres employes ne sont pas affectes.
        </p>
        <DataTable columns={columns} rows={pager.slice} empty={loading ? "Chargement…" : "Aucun employe."} />
        <Pagination
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          onPage={pager.setPage}
        />
      </AdminPanel>

      <Modal
        open={!!detail}
        title={detail ? `Fiche employe — ${detail.name}` : "Fiche employe"}
        onClose={() => setDetail(null)}
      >
        <p className="muted admin-modal-intro">
          Mettez a jour la fiche professionnelle (matricule, poste, service). Les modules visibles a la connexion
          se gerent via le bouton <strong>Permissions</strong> dans le tableau.
        </p>
        <form className="admin-form-grid" onSubmit={save}>
          <label>
            Matricule
            <input
              value={form.matricule}
              onChange={(e) => setForm((s) => ({ ...s, matricule: e.target.value }))}
            />
          </label>
          <label>
            Poste
            <input value={form.poste} onChange={(e) => setForm((s) => ({ ...s, poste: e.target.value }))} />
          </label>
          <label>
            Service
            <input value={form.service} onChange={(e) => setForm((s) => ({ ...s, service: e.target.value }))} />
          </label>
          <label>
            Salaire
            <input
              type="number"
              min="0"
              value={form.salaire}
              onChange={(e) => setForm((s) => ({ ...s, salaire: e.target.value }))}
            />
          </label>
          <label>
            Date embauche
            <input
              type="date"
              value={form.hire_date}
              onChange={(e) => setForm((s) => ({ ...s, hire_date: e.target.value }))}
            />
          </label>
          <FormModalActions
            onCancel={() => setDetail(null)}
            secondary={
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() =>
                  detail &&
                  setPermUser({
                    id: detail.id,
                    name: detail.name,
                    email: detail.email,
                    role: detail.role || "employe",
                  })
                }
              >
                Modules visibles
              </button>
            }
            submitLabel="Enregistrer"
          />
        </form>
      </Modal>

      <UserPermissionsModal
        user={permUser}
        open={Boolean(permUser)}
        onClose={() => setPermUser(null)}
        onSaved={() => {
          setPermUser(null);
          setFlash("Permissions mises a jour. L employe doit se reconnecter.");
          load();
        }}
        setFlash={setFlash}
        setError={setError}

      />
    </>
  );
}
