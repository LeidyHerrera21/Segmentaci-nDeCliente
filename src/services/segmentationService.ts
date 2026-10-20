import type { Customer, SegmentationSummary } from "../types";

export interface SegmentationResult {
  customers: Customer[];
  summary: SegmentationSummary;
}

/**
 * Solicita la segmentación al backend Python mediante la API REST.
 * El cálculo K-Means se ejecuta en el servidor con scikit-learn.
 */
export async function runKMeans(customers: Customer[], k: number): Promise<SegmentationResult> {
  const response = await fetch("/api/segmentation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ k, customers })
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : "No fue posible ejecutar la segmentación en la API.";
    throw new Error(message);
  }

  return payload as SegmentationResult;
}
