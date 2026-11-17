"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { translate } from "@/lib/i18n";
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
    <Context.Provider value={{ language, t: (s) => translate(s, language) }}>
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

export function T({ children }: { children: string }) {
  const { t } = useLanguage();
  return <>{t(children)}</>;
}
