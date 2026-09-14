import React, { useEffect, useState } from 'react';
import { Check, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const THEME_KEY = 'ifixflow-theme';

const applyTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent('ifixflow-theme-changed', { detail: theme }));
};

const Settings = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const options = [
    {
      value: 'light',
      title: 'Fondo blanco',
      description: 'Interfaz clara para trabajar durante el día.',
      icon: Sun,
      preview: 'bg-white border-zinc-200',
    },
    {
      value: 'dark',
      title: 'Fondo oscuro',
      description: 'Interfaz oscura para reducir el brillo de la pantalla.',
      icon: Moon,
      preview: 'bg-zinc-900 border-zinc-700',
    },
  ];

  return (
    <div className="max-w-3xl space-y-6" data-testid="settings-page">
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Configuración</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Personaliza la apariencia de iFixFlow.</p>
          </div>
        </div>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-zinc-100">Apariencia</CardTitle>
          <CardDescription className="dark:text-zinc-400">Elige el color de fondo del sistema. El ajuste se guarda en este dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {options.map(({ value, title, description, icon: Icon, preview }) => {
              const selected = theme === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setTheme(value)}
                  data-testid={`theme-${value}`}
                  className={`relative rounded-lg border p-4 text-left transition-colors ${selected ? 'border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'}`}
                >
                  <div className={`mb-4 h-20 rounded-md border ${preview} p-3`}>
                    <div className={`h-2 w-16 rounded ${value === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                    <div className={`mt-2 h-2 w-10 rounded ${value === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon size={20} className="mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                    </div>
                  </div>
                  {selected && <Check size={18} className="absolute right-3 top-3 text-blue-600 dark:text-blue-400" aria-label="Seleccionado" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
