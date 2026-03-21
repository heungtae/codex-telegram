import { useEffect, useState } from "react";

import Login from "./features/auth/components/Login";
import { api } from "./features/common/api";
import {
  applyDocumentTheme,
  normalizeTheme,
  persistTheme,
  readDocumentTheme,
} from "./features/common/theme";
import AuthenticatedApp from "./features/app/AuthenticatedApp";

function App() {
  const [me, setMe] = useState(null);
  const [theme, setTheme] = useState(() => readDocumentTheme());

  const loadSession = async () => {
    try {
      const who = await api("/api/auth/me");
      setMe(who);
    } catch (_e) {
      setMe(null);
    }
  };

  const handleLoggedIn = (who) => {
    if (who && typeof who === "object") {
      setMe(who);
      return;
    }
    loadSession().catch(() => {});
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const nextTheme = normalizeTheme(theme);
    applyDocumentTheme(nextTheme);
    persistTheme(nextTheme);
  }, [theme]);

  if (!me) {
    return <Login onLoggedIn={handleLoggedIn} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return <AuthenticatedApp me={me} theme={theme} onToggleTheme={toggleTheme} />;
}

export default App;
