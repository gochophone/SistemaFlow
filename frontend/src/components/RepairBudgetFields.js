import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCLP } from '@/utils/currency';
import { budgetBreakdown, grossFromNet, netFromGross, parseBudgetInput } from '@/utils/repairBudget';

const numberFormat = new Intl.NumberFormat('es-CL');

const RepairBudgetFields = ({ amount, vatIncluded, onChange, idPrefix, amountTestId }) => {
  const breakdown = budgetBreakdown(amount, vatIncluded);
  const changeNet = (event) => {
    const net = parseBudgetInput(event.target.value);
    onChange({ amount: net === null ? '' : vatIncluded ? grossFromNet(net) : net, vatIncluded });
  };
  const changeGross = (event) => {
    const gross = parseBudgetInput(event.target.value);
    onChange({ amount: gross === null ? '' : gross, vatIncluded: true });
  };
  const changeVat = (checked) => {
    if (breakdown === null) {
      onChange({ amount: '', vatIncluded: checked });
      return;
    }
    onChange({
      amount: checked ? grossFromNet(breakdown.net) : netFromGross(breakdown.total),
      vatIncluded: checked,
    });
  };

  return (
    <div className="space-y-3" data-testid={`${idPrefix}-budget-fields`}>
      <div>
        <Label htmlFor={`${idPrefix}-net`} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {vatIncluded ? 'Valor neto (CLP)' : 'Valor de la reparación (CLP)'}
        </Label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-zinc-500 dark:text-zinc-400">$</span>
          <Input id={`${idPrefix}-net`} type="text" inputMode="numeric"
            value={breakdown === null ? '' : numberFormat.format(breakdown.net)}
            onChange={changeNet} placeholder="150.000"
            className="border-zinc-200 pl-7 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            data-testid={amountTestId} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch id={`${idPrefix}-vat`} checked={vatIncluded} onCheckedChange={changeVat}
          data-testid={`${idPrefix}-vat-switch`} />
        <Label htmlFor={`${idPrefix}-vat`} className="text-sm text-zinc-900 dark:text-zinc-100">Agregar IVA (19%)</Label>
      </div>

      {vatIncluded && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-gross`} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Valor con IVA (CLP)</Label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-zinc-500 dark:text-zinc-400">$</span>
              <Input id={`${idPrefix}-gross`} type="text" inputMode="numeric"
                value={breakdown === null ? '' : numberFormat.format(breakdown.total)}
                onChange={changeGross} placeholder="178.500"
                className="border-zinc-200 pl-7 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                data-testid={`${idPrefix}-gross-input`} />
            </div>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">IVA (19%)</p>
            <p className="text-lg font-semibold text-blue-950 dark:text-blue-100" data-testid={`${idPrefix}-vat-amount`}>
              {breakdown === null ? '—' : formatCLP(breakdown.vat)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairBudgetFields;
