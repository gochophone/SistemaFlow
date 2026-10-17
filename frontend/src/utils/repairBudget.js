export const VAT_RATE = 0.19;

export const parseBudgetInput = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
};

export const grossFromNet = (net) => net + Math.round(net * VAT_RATE);

export const netFromGross = (gross) => Math.round(gross / (1 + VAT_RATE));

export const budgetBreakdown = (amount, vatIncluded) => {
  if (amount === '' || amount === null || amount === undefined) return null;
  const total = Number(amount);
  if (!Number.isFinite(total) || total < 0) return null;
  const net = vatIncluded ? netFromGross(total) : total;
  return { net, vat: vatIncluded ? total - net : 0, total };
};
