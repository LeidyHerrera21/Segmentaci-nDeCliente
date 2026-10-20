import type { Customer } from "../types";

export type CustomerInput = Omit<Customer, "segmento">;

export function validateCustomer(input: CustomerInput, existing: Customer[], originalId?: string): string | null {
  if (!input.id.trim()) return "El código del cliente es obligatorio.";
  if (!input.nombre.trim()) return "El nombre del cliente es obligatorio.";
  if ([input.gastoAcumulado, input.visitas6Meses, input.antiguedadMeses].some((value) => !Number.isFinite(value))) {
    return "Gasto, visitas y antigüedad deben ser números válidos.";
  }
  if (input.gastoAcumulado < 0 || input.visitas6Meses < 0 || input.antiguedadMeses < 0) {
    return "El gasto, las visitas y la antigüedad no pueden ser negativos.";
  }
  const duplicate = existing.some((customer) =>
    customer.id.trim().toLowerCase() === input.id.trim().toLowerCase() &&
    customer.id !== originalId
  );
  if (duplicate) return "Ya existe un cliente con ese código.";
  return null;
}
