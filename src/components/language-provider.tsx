"use client";
import { createContext, useContext, useEffect, useState } from "react";
const es: Record<string, string> = {
  "Explore resources": "Explorar recursos",
  "Finding your next step": "Tu próximo paso",
  "About the project": "Sobre el proyecto",
  Saved: "Guardados",
  "Sign in": "Entrar",
  "Your account": "Tu cuenta",
  Community: "Comunidad",
  "giving recovery a home": "un hogar para la recuperación",
  "Find support": "Buscar ayuda",
  "Meeting, service, or keyword…": "Reunión, servicio o palabra clave…",
  "City, state, ZIP or street address":
    "Ciudad, estado, código postal o dirección",
  "All resources": "Todos los recursos",
  Meetings: "Reuniones",
  "Treatment & detox": "Tratamiento y desintoxicación",
  "Mental health": "Salud mental",
  "Therapy & counseling": "Terapia",
  "Recovery support": "Apoyo para la recuperación",
  "More filters": "Más filtros",
  "Find a meeting": "Buscar una reunión",
  "Explore treatment": "Explorar tratamiento",
  "Find a therapist": "Buscar terapeuta",
  "Support for daily life": "Apoyo para la vida diaria",
  "Previous resources": "Resultados anteriores",
  "Next resources": "Más resultados",
  Username: "Nombre de usuario",
  Password: "Contraseña",
  "Create account": "Crear cuenta",
  "Recover account": "Recuperar cuenta",
  "Sign in with a passkey": "Entrar con una clave de acceso",
};
const Context = createContext({ language: "en", t: (s: string) => s });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState("en");
  useEffect(() => {
    try {
      const l = localStorage.getItem("atlas:language");
      if (l === "es") setLanguage(l);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <Context.Provider
      value={{ language, t: (s) => (language === "es" ? (es[s] ?? s) : s) }}
    >
      <div className="language-switch">
        <label>
          Language / Idioma{" "}
          <select
            aria-label="Interface language"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              try {
                localStorage.setItem("atlas:language", e.target.value);
              } catch {}
            }}
          >
            <option value="en">English</option>
            <option value="es">Español (beta)</option>
          </select>
        </label>
        {language === "es" ? (
          <span lang="es">
            La interfaz en español es una versión preliminar. Los datos
            conservan el idioma de la fuente.
          </span>
        ) : null}
      </div>
      {children}
    </Context.Provider>
  );
}
export function useLanguage() {
  return useContext(Context);
}
