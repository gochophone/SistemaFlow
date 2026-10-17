import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const API = process.env.REACT_APP_BACKEND_URL;
const OTHER_ISSUE = '__other_issue__';
const COMMON_ISSUES = [
  'No enciende', 'Corto', 'Cámara', 'Pantalla', 'Micrófono',
  'Audio', 'Face ID', 'Señal', 'Batería', 'Flex carga',
];

const RepairIssueSelector = ({ value, onChange }) => {
  const { getAuthHeader } = useAuth();
  const [options, setOptions] = useState(COMMON_ISSUES);
  const [frequent, setFrequent] = useState([]);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get(`${API}/api/repairs/issues`, { headers: getAuthHeader() })
      .then(({ data }) => {
        if (!active) return;
        setOptions(Array.isArray(data.options)
          ? [...COMMON_ISSUES, ...data.options.filter((issue) => !COMMON_ISSUES.includes(issue))]
          : COMMON_ISSUES);
        setFrequent(Array.isArray(data.frequent) ? data.frequent.slice(0, 5) : []);
      })
      .catch(() => {
        // Las opciones comunes siguen disponibles si falla la carga del historial.
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseIssue = (issue) => {
    setManualMode(issue === OTHER_ISSUE);
    onChange(issue === OTHER_ISSUE ? '' : issue);
  };
  const savedIssues = options.filter((issue) => !COMMON_ISSUES.includes(issue));

  return (
    <div className="space-y-2">
      <Label htmlFor="reported_issue" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Falla reportada *</Label>
      <Select value={manualMode ? OTHER_ISSUE : options.includes(value) ? value : ''} onValueChange={chooseIssue}>
        <SelectTrigger id="reported_issue" className="border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" data-testid="reported-issue-select">
          <SelectValue placeholder="Seleccionar falla" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Fallas comunes</SelectLabel>
            {COMMON_ISSUES.map((issue) => <SelectItem key={issue} value={issue}>{issue}</SelectItem>)}
          </SelectGroup>
          {savedIssues.length > 0 && <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Guardadas por tu negocio</SelectLabel>
              {savedIssues.map((issue) => <SelectItem key={issue} value={issue}>{issue}</SelectItem>)}
            </SelectGroup>
          </>}
          <SelectSeparator />
          <SelectItem value={OTHER_ISSUE}>Especificar otra falla…</SelectItem>
        </SelectContent>
      </Select>

      {manualMode && (
        <Input
          id="reported_issue_manual"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={120}
          required
          autoFocus
          placeholder="Escribe la falla para guardarla con la orden"
          className="border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          data-testid="reported-issue-input"
        />
      )}

      <div className="pt-2" data-testid="frequent-issues">
        <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Las 5 fallas más usadas</p>
        {frequent.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {frequent.map(({ name, count }) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={!manualMode && value === name}
                onClick={() => chooseIssue(name)}
                className={!manualMode && value === name
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200'
                  : 'dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800'}
                data-testid={`frequent-issue-${name}`}
              >
                {name} <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">({count})</span>
              </Button>
            ))}
          </div>
        ) : <p className="text-xs text-zinc-500 dark:text-zinc-400">Aparecerán cuando haya reparaciones registradas.</p>}
      </div>
    </div>
  );
};

export default RepairIssueSelector;
