import { useState, useEffect, startTransition } from "react";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (
        token &&
        token !== "undefined" &&
        storedUser &&
        storedUser !== "undefined"
      ) {
        const parsedUser = JSON.parse(storedUser);

        startTransition(() => {
          setUser(parsedUser);
          setIsAuthenticated(true);
        });

        console.log("✅ Sessão restaurada:", parsedUser.name);
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        console.log("⚠️ Nenhuma sessão válida encontrada");
      }
    } catch (error) {
      console.error("❌ Erro ao restaurar sessão:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, []);

  const login = (userData, token) => {
    if (!userData || !token) {
      console.error("❌ Dados de login inválidos!");
      return;
    }

    startTransition(() => {
      setUser(userData);
      setIsAuthenticated(true);
    });

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    startTransition(() => {
      setUser(null);
      setIsAuthenticated(false);
    });

    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
