import { useEffect, useState } from "react";
import { api, clearAuthToken, forgotPassword, login, logout, resetPassword } from "./api";
import { AdminPage } from "./admin/AdminPage";
import { EmployeePage } from "./employee/EmployeePage";
import { HrPage } from "./hr/HrPage";
import { normalizeUserFromAuth } from "./permissions";

const DEMO_ACCOUNTS = [
  {
    roleLabel: "ADMIN",
    role: "Admin",
    email: "admin@grh.local",
    password: "Admin123!",
    description: "Gestion des utilisateurs, roles et responsabilites",
  },
  {
    roleLabel: "RH",
    role: "RH",
    email: "rh@grh.local",
    password: "Rh123456!",
    description: "Gestion des employes, conges, formations et evaluations",
  },
  {
    roleLabel: "EMPLOYEE",
    role: "Employe",
    email: "employe@grh.local",
    password: "Emp123456!",
    description: "Consultation profil, demandes de conge, suivi formations",
  },
];

function validateLoginFields(email, password) {
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  if (!trimmedEmail) return "L email est obligatoire.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return "Format d email invalide.";
  if (!trimmedPassword) return "Le mot de passe est obligatoire.";
  if (trimmedPassword.length < 8) return "Le mot de passe doit contenir au moins 8 caracteres.";
  return "";
}

const ROLE_META = {
  admin: { title: "Espace administrateur", eyebrow: "Securise", theme: "admin" },
  rh: { title: "Espace Responsable RH", eyebrow: "Pilotage RH", theme: "rh" },
  employe: { title: "Espace employe", eyebrow: "Collaborateur", theme: "employe" },
};

function Badge({ role }) {
  return <span className={`badge ${role}`}>{role.toUpperCase()}</span>;
}

function LoadingScreen() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <p className="app-loading__brand">GRH Pro</p>
      <div className="app-loading__spinner" aria-hidden />
      <p>Chargement de votre espace…</p>
    </div>
  );
}

function LoginForm({ onLogin, error, setError }) {
  const [email, setEmail] = useState("rh@grh.local");
  const [password, setPassword] = useState("Rh123456!");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [success, setSuccess] = useState("");
  const [fieldError, setFieldError] = useState("");

  function fillDemo(account) {
    clearAuthToken();
    setEmail(account.email);
    setPassword(account.password);
    setForgotMode(false);
    setError("");
    setSuccess("");
    setFieldError("");
  }

  useEffect(() => {
    clearAuthToken();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setFieldError("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!forgotMode) {
      const validationMessage = validateLoginFields(trimmedEmail, trimmedPassword);
      if (validationMessage) {
        setFieldError(validationMessage);
        setLoading(false);
        return;
      }
    } else if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFieldError("Saisissez un email professionnel valide.");
      setLoading(false);
      return;
    }

    try {
      if (forgotMode) {
        const result = await forgotPassword(trimmedEmail);
        setSuccess(result.message);
      } else {
        const result = await login(trimmedEmail, trimmedPassword);
        onLogin(normalizeUserFromAuth(result));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div>
          <div className="auth-brand__logo">
            <span className="auth-brand__mark">G</span>
            <span className="auth-brand__name">GRH Pro</span>
          </div>
          <h1>Gestion des ressources humaines, simplifiee.</h1>
          <p className="auth-brand__tagline">
            Plateforme web centralisee pour la gestion RH — conges, formations, evaluations et carrieres.
          </p>

          <ul className="auth-features">
            <li>
              <span className="auth-features__icon" aria-hidden>
                ◆
              </span>
              <span>Tableaux de bord dedies par role</span>
            </li>
            <li>
              <span className="auth-features__icon" aria-hidden>
                ◆
              </span>
              <span>Roles et responsabilites en langage clair</span>
            </li>
            <li>
              <span className="auth-features__icon" aria-hidden>
                ◆
              </span>
              <span>Workflow complet des conges (demande → validation RH)</span>
            </li>
          </ul>
        </div>

        <footer className="auth-brand__footer">
          <p>Projet academique & professionnel — OFPPT WFS204</p>
          <p className="auth-brand__footer-sub">Application securisee React + Laravel + MySQL</p>
        </footer>
      </aside>

      <div className="auth-panel">
        <form className="card auth-card" onSubmit={handleSubmit} noValidate>
          <h2>{forgotMode ? "Mot de passe oublie" : "Connexion securisee"}</h2>
          <p className="auth-card__sub">
            {forgotMode
              ? "Saisissez votre email pour recevoir un lien de reinitialisation."
              : "Authentification via API REST — token Bearer stocke localement apres connexion."}
          </p>

          <div>
            <label htmlFor="login-email">Email professionnel</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError("");
              }}
              placeholder="rh@grh.local"
              autoComplete="email"
              required
            />
          </div>

          {!forgotMode && (
            <div>
              <label htmlFor="login-password">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldError("");
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          )}

          {fieldError ? <p className="error">{fieldError}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="success">{success}</p> : null}

          <button type="submit" className="btn-primary-solid" disabled={loading}>
            {loading ? "Traitement…" : forgotMode ? "Envoyer le lien" : "Se connecter"}
          </button>

          <button
            type="button"
            className="auth-link-btn"
            onClick={() => {
              setError("");
              setSuccess("");
              setFieldError("");
              setForgotMode((prev) => !prev);
            }}
          >
            {forgotMode ? "← Retour a la connexion" : "Mot de passe oublie ?"}
          </button>

          {!forgotMode ? (
            <div className="auth-demo">
              <p className="auth-demo__title">Comptes de demonstration</p>
              <div className="auth-demo__accounts">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    className={`auth-demo__row${email === acc.email ? " auth-demo__row--active" : ""}`}
                    onClick={() => fillDemo(acc)}
                  >
                    <div className="auth-demo__row-main">
                      <span className="auth-demo__role">{acc.roleLabel}</span>
                      <span className="auth-demo__email">{acc.email}</span>
                    </div>
                    <span className="auth-demo__desc">{acc.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") || "");
    setToken(params.get("token") || "");
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await resetPassword(email, token, password, passwordConfirmation);
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel" style={{ gridColumn: "1 / -1", maxWidth: 480, margin: "auto" }}>
        <form className="card auth-card" onSubmit={handleSubmit}>
          <h2>Reinitialisation du mot de passe</h2>
          <p className="auth-card__sub">Choisissez un nouveau mot de passe securise.</p>
          <div>
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="reset-token">Token</label>
            <input id="reset-token" type="text" value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="reset-pass">Nouveau mot de passe</label>
            <input
              id="reset-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="reset-pass2">Confirmer</label>
            <input
              id="reset-pass2"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          <button type="submit" className="btn-primary-solid" disabled={loading}>
            {loading ? "Traitement…" : "Valider"}
          </button>
          <a href="/">← Retour a la connexion</a>
        </form>
      </div>
    </div>
  );
}

function AdminZone({ currentUser }) {
  return <AdminPage currentUser={currentUser} currentUserEmail={currentUser?.email} />;
}

function TopbarIcon({ role }) {
  if (role === "admin") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  if (role === "rh") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function App() {
  const isResetRoute = window.location.pathname === "/reset-password";
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api("/me")
      .then((data) => setUser(normalizeUserFromAuth(data)))
      .catch(() => {
        clearAuthToken();
        setUser(null);
        setError("");
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = (e) => {
      clearAuthToken();
      setUser(null);
      setError(e.detail?.message || "Session expiree. Reconnectez-vous.");
    };
    window.addEventListener("grh:auth-expired", onExpired);
    return () => window.removeEventListener("grh:auth-expired", onExpired);
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setError("");
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    if (isResetRoute) {
      return <ResetPasswordForm />;
    }
    return <LoginForm onLogin={setUser} error={error} setError={setError} />;
  }

  const meta = ROLE_META[user.role] || { title: `Espace ${user.role}`, eyebrow: "GRH Pro", theme: "" };
  const themeClass = meta.theme ? ` topbar--${meta.theme} dashboard--${meta.theme}` : "";

  return (
    <main className={`dashboard${themeClass}`}>
      <header className={`topbar${meta.theme ? ` topbar--${meta.theme}` : ""}`}>
        <div className="topbar__intro">
          <p className={`topbar__eyebrow${meta.theme ? ` topbar__eyebrow--${meta.theme}` : ""}`}>
            <span className={`topbar__eyebrow-icon${meta.theme ? ` topbar__eyebrow-icon--${meta.theme}` : ""}`} aria-hidden>
              <TopbarIcon role={user.role} />
            </span>
            {meta.eyebrow}
          </p>
          <h1>{meta.title}</h1>
          <p>
            Bienvenue, <strong>{user.name}</strong> <Badge role={user.role} />
          </p>
        </div>
        <button type="button" className="btn-logout" onClick={handleLogout}>
          Se deconnecter
        </button>
      </header>

      <div className={`app-content${user.role === "admin" ? " app-content--admin" : ""}`}>
        {user.role === "admin" && <AdminZone currentUser={user} />}
        {user.role === "employe" && <EmployeePage currentUser={user} />}
        {user.role === "rh" && <HrPage currentUser={user} />}
      </div>
    </main>
  );
}