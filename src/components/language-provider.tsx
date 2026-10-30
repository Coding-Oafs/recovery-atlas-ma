"use client";
import { createContext, useContext, useEffect, useState } from "react";
const es: Record<string, string> = {
  "Explore resources": "Explorar recursos",
  "Finding your next step": "Tu pr�ximo paso",
  "About the project": "Sobre el proyecto",
  Saved: "Guardados",
  "Sign in": "Entrar",
  "Your account": "Tu cuenta",
  Community: "Comunidad",
  "giving recovery a home": "un hogar para la recuperaci�n",
  "Find support": "Buscar ayuda",
  "Meeting, service, or keyword�": "Reuni�n, servicio o palabra clave�",
  "City, state, ZIP or street address":
    "Ciudad, estado, c�digo postal o direcci�n",
  "All resources": "Todos los recursos",
  Meetings: "Reuniones",
  "Treatment & detox": "Tratamiento y desintoxicaci�n",
  "Mental health": "Salud mental",
  "Therapy & counseling": "Terapia",
  "Recovery support": "Apoyo para la recuperaci�n",
  "More filters": "M�s filtros",
  "Find a meeting": "Buscar una reuni�n",
  "Explore treatment": "Explorar tratamiento",
  "Find a therapist": "Buscar terapeuta",
  "Support for daily life": "Apoyo para la vida diaria",
  "Previous resources": "Resultados anteriores",
  "Next resources": "M�s resultados",
  Username: "Nombre de usuario",
  Password: "Contrase�a",
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
            <option value="es">Espa�ol (beta)</option>
          </select>
        </label>
        {language === "es" ? (
          <span lang="es">
            La interfaz en espa�ol es una versi�n preliminar. Los datos
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
