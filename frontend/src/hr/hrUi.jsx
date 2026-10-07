export function HrModuleHeader({ icon, title, description, aside }) {
  return (
    <header className="hr-module-head">
      <div className="hr-module-head__main">
        <span className="hr-module-head__icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h3 className="hr-module-head__title">{title}</h3>
          {description ? <p className="hr-module-head__desc">{description}</p> : null}
        </div>
      </div>
      {aside ? <div className="hr-module-head__aside">{aside}</div> : null}
    </header>
  );
}

export function HrStatChip({ label, value, tone = "default" }) {
  return (
    <div className={`hr-stat-chip hr-stat-chip--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function HrEmptyState({ title, message }) {
  return (
    <div className="hr-empty-state">
      <p className="hr-empty-state__title">{title}</p>
      <p className="muted">{message}</p>
    </div>
  );
}

export function HrSection({ icon, title, description, aside, children }) {
  return (
    <section className="card hr-card hr-module-card">
      <HrModuleHeader icon={icon} title={title} description={description} aside={aside} />
      <div className="hr-module-body">{children}</div>
    </section>
  );
}

export function HrSubpanelTitle({ children }) {
  return <h4 className="hr-subpanel-title">{children}</h4>;
}
