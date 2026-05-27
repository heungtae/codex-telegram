import { useState } from "react";

import { api } from "../../common/api";
import { ThemeIcon } from "../../common/components/Icons";

export default function Login({ onLoggedIn, theme, onToggleTheme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const who = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLoggedIn(who);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-head">
          <div className="login-copy">
            <h2>Codex Web</h2>
            <p>Sign in with your allowlisted account.</p>
          </div>
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <ThemeIcon theme={theme} />
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="login-actions">
          <button className="primary" type="submit">Sign in</button>
        </div>
        {error ? <p className="login-error">{error}</p> : null}
      </form>
    </div>
  );
}
