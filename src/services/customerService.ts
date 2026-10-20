import type { Customer } from "../types";
import seedCustomers from "../data/seed.json";

const STORAGE_KEY = "nova_customers_v1";

export function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Customer[];
    }
  } catch {
    // Si el almacenamiento está dañado, se recuperan los datos de demostración.
  }
  const initial = seedCustomers.map((customer) => ({ ...customer }));
  saveCustomers(initial);
  return initial;
}

export function saveCustomers(customers: Customer[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}
