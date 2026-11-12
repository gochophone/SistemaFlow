export const REPAIR_STATUS_CONFIG = {
  not_repaired: { label: 'Sin reparación', color: 'bg-red-100 text-red-800 border-red-200' },
  in_repair: { label: 'En reparación', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Reparado', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 border-green-200' },
};

// Keep existing orders readable without changing their saved status or dates.
export const visibleRepairStatus = (status) =>
  status === 'received' || status === 'diagnosis' || status === 'in_progress'
    ? 'in_repair'
    : status === 'cancelled' ? 'not_repaired' : status;
