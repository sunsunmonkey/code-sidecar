import { ErrorType } from "code-sidecar-shared/types/errors";
import type { ErrorLogEntry } from "./errorTypes";

export type ErrorStatistics = {
  total: number;
  byType: Record<ErrorType, number>;
  resolved: number;
  unresolved: number;
};

export const buildErrorStatistics = (
  errorLog: ErrorLogEntry[]
): ErrorStatistics => {
  const stats: ErrorStatistics = {
    total: errorLog.length,
    byType: {} as Record<ErrorType, number>,
    resolved: 0,
    unresolved: 0,
  };

  Object.values(ErrorType).forEach(type => {
    stats.byType[type] = 0;
  });

  errorLog.forEach(entry => {
    stats.byType[entry.type]++;
    if (entry.resolved) {
      stats.resolved++;
    } else {
      stats.unresolved++;
    }
  });

  return stats;
};
