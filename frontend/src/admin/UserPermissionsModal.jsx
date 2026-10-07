import { useCallback, useEffect, useState } from "react";
import { getPermissionsCatalog, getUserPermissions, updateUserPermissions } from "../api";
import {
  ALL_PERMISSION_SLUGS,
  labelForPermission,
  PERMISSION_PRESETS,
  permissionsForRole,
} from "../permissions";

export function UserPermissionsModal({
  user,
  open,
  onClose,
  onSaved,
  setFlash,
  setError,
  draft = false,
}) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const cat = await getPermissionsCatalog().catch(() => ({ permissions: [] }));
      const allowed = permissionsForRole(user.role);
      const rows = cat.permissions?.length
        ? cat.permissions.filter((p) => allowed.includes(p.slug))
        : ALL_PERMISSION_SLUGS.filter((slug) => allowed.includes(slug)).map((slug) => ({ slug, name: labelForPermission(slug) }));
      setCatalog(rows.length ? rows : cat.permissions || []);
      if (draft) {
        setSelected([...(user.permissions || [])]);
        return;
      }
      const detail = await getUserPermissions(user.id);
      setSelected([...(detail.permissions || [])]);
    } catch (e) {
      setError(e?.message || "Chargement des permissions impossible");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.permissions, draft, user?.role, setError]);

  useEffect(() => {
    if (open && user?.id) load();
  }, [open, user?.id, load]);

  function toggle(slug) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const rolePresetEntries = user?.role === 'employe' ? Object.entries(PERMISSION_PRESETS) : [];

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (draft) {
        onSaved?.(selected);
        setFlash?.("Permissions enregistrees pour la prochaine creation.");
        onClose?.();
        return;
      }
      await updateUserPermissions(user.id, selected);
      setFlash?.("Permissions mises a jour. L utilisateur devra se reconnecter.");
      onSaved?.(selected);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !user) return null;

  return (
    <div className="perm-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="perm-modal-title">
      <div className="perm-modal card">
        <header className="perm-modal__head">
          <div>
            <h3 id="perm-modal-title">Permissions — {user.name}</h3>
            <p className="muted">{user.email} · role {user.role}</p>
          </div>
          <button type="button" className="btn-ghost-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        {rolePresetEntries.length ? (
          <div className="perm-presets">
            {rolePresetEntries.map(([key, preset]) => (
              <button
                key={key}
                type="button"
                className="btn-ghost-sm"
                onClick={() => setSelected([...preset.slugs])}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <div className="perm-grid">
            {catalog.map((p) => {
              const slug = p.slug;
              const checked = selected.includes(slug);
              return (
                <label key={slug} className={`perm-chip${checked ? " perm-chip--on" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(slug)} />
                  <span className="perm-chip__title">{p.name || labelForPermission(slug)}</span>
                  <span className="perm-chip__slug">{slug}</span>
                </label>
              );
            })}
          </div>
        )}

        <footer className="perm-modal__foot form-actions-bar">
          <button type="button" className="btn-ghost-sm" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="button" className="btn-primary-solid" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}
