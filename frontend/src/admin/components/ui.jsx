import { useMemo, useState } from "react";

export function useFlash() {
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  return {
    flash,
    setFlash,
    error,
    setError,
    clear: () => {
      setFlash("");
      setError("");
    },
  };
}

export function usePagedFilter(rows, { searchKeys = [], pageSize = 8 } = {}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(query))
    );
  }, [rows, q, searchKeys]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return {
    q,
    setQ,
    page: safePage,
    setPage,
    filtered,
    slice,
    totalPages,
    total: filtered.length,
  };
}

export function ReadOnlyBanner() {
  return (
    <div className="admin-readonly-banner" role="status">
      <span className="admin-readonly-banner__icon" aria-hidden>👁</span>
      <div>
        <strong>Mode consultation</strong>
        <p>En tant qu administrateur, vous pouvez consulter les donnees RH. Les actions (creation, validation, modification) sont reservees au responsable RH.</p>
      </div>
    </div>
  );
}

export function AdminFlash({ flash, error }) {
  return (
    <>
      {flash ? <p className="admin-alert admin-alert--ok">{flash}</p> : null}
      {error ? <p className="admin-alert admin-alert--err">{error}</p> : null}
    </>
  );
}

export function AdminPanel({ title, desc, children, actions }) {
  return (
    <section className="admin-panel card">
      <div className="admin-panel__head">
        <div>
          <h3>{title}</h3>
          {desc ? <p className="muted">{desc}</p> : null}
        </div>
        {actions ? <div className="admin-panel__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "blue", icon, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`admin-dash-kpi admin-dash-kpi--${tone}${onClick ? " admin-dash-kpi--clickable" : ""}`}
      onClick={onClick}
    >
      {icon ? (
        <span className="admin-dash-kpi__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="admin-dash-kpi__body">
        <span className="admin-dash-kpi__value">{value}</span>
        <span className="admin-dash-kpi__label">{label}</span>
        {hint ? <span className="admin-dash-kpi__hint">{hint}</span> : null}
      </div>
    </Tag>
  );
}

const BAR_FILL_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

export function BarChart({
  items,
  labelKey = "label",
  valueKey = "total",
  formatLabel = (v) => v,
  variant = "default",
}) {
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
  if (!items.length) return <p className="admin-dash-empty muted">Aucune donnee.</p>;
  const wrapClass = variant === "dash" ? "admin-dash-bars" : "admin-bars";
  const rowClass = variant === "dash" ? "admin-dash-bars__row" : "admin-bars__row";
  const labelClass = variant === "dash" ? "admin-dash-bars__label" : "admin-bars__label";
  const trackClass = variant === "dash" ? "admin-dash-bars__track" : "admin-bars__track";
  const fillClass = variant === "dash" ? "admin-dash-bars__fill" : "admin-bars__fill";
  const valClass = variant === "dash" ? "admin-dash-bars__val" : "admin-bars__val";

  return (
    <div className={wrapClass} role="img" aria-label="Graphique">
      {items.map((item, idx) => (
        <div key={item[labelKey]} className={rowClass}>
          <span className={labelClass}>{formatLabel(item[labelKey])}</span>
          <div className={trackClass}>
            <div
              className={fillClass}
              style={{
                width: `${(Number(item[valueKey]) / max) * 100}%`,
                ...(variant === "dash"
                  ? { background: BAR_FILL_COLORS[idx % BAR_FILL_COLORS.length] }
                  : {}),
              }}
            />
          </div>
          <span className={valClass}>{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ columns, rows, rowKey = (r) => r.id, empty = "Aucune donnee." }) {
  if (!rows.length) return <p className="admin-empty muted">{empty}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key || c.label}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) {
    return <p className="admin-pager__info muted">{total} resultat{total > 1 ? "s" : ""}</p>;
  }
  return (
    <div className="admin-pager">
      <p className="muted">
        {total} resultat{total > 1 ? "s" : ""} — page {page}/{totalPages}
      </p>
      <div className="admin-pager__btns">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Precedent
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Suivant
        </button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Rechercher…" }) {
  return (
    <input
      className="admin-search"
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export function Modal({ open, title, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`admin-modal${wide ? " admin-modal--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
      >
        <div className="admin-modal__head">
          <h3 id="admin-modal-title">{title}</h3>
          <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob(["\ufeff" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("fr-FR");
}

export function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** Barre de boutons standard : Annuler (ghost) → action secondaire → Enregistrer (bleu). */
export function FormModalActions({
  onCancel,
  cancelLabel = "Annuler",
  showCancel = true,
  secondary = null,
  submitLabel = "Enregistrer",
  submitDisabled = false,
}) {
  return (
    <div className="admin-form-actions admin-form-span2 form-actions-bar">
      {showCancel && onCancel ? (
        <button type="button" className="btn-ghost-sm" onClick={onCancel}>
          {cancelLabel}
        </button>
      ) : null}
      {secondary}
      <button type="submit" className="btn-primary-solid" disabled={submitDisabled}>
        {submitLabel}
      </button>
    </div>
  );
}

export function EditRowButton({ onClick, children = "Modifier", disabled = false }) {
  return (
    <button type="button" className="btn-secondary-sm" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function DangerRowButton({ onClick, children = "Supprimer", disabled = false }) {
  return (
    <button type="button" className="btn-secondary-sm btn-danger-sm" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export const LEAVE_TYPES = [
  { value: "ANNUEL", label: "Conge annuel" },
  { value: "MALADIE", label: "Maladie" },
  { value: "SANS_SOLDE", label: "Sans solde" },
  { value: "AUTRE", label: "Autre" },
];

export const LEAVE_STATUS = {
  EN_ATTENTE: { label: "En attente", cls: "pill--warn" },
  VALIDE: { label: "Valide", cls: "pill--ok" },
  REFUSE: { label: "Refuse", cls: "pill--danger" },
};

export function StatusPill({ status }) {
  const meta = LEAVE_STATUS[status] || { label: status, cls: "pill--neutral" };
  return <span className={`admin-pill ${meta.cls}`}>{meta.label}</span>;
}
