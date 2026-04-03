import { db } from "@/db";
import { changeHistory } from "@/db/schema";

interface HistoryPayload {
  projectId: number;
  entityType: string; // 'lead', 'achievement', 'project', 'user'
  entityId: number;
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: number;
  source?: "MANUAL" | "CRM_IMPORT" | "SYNC";
}

/**
 * Записывает изменение в таблицу истории.
 * Мы используем JSONB для хранения старого и нового значения, 
 * чтобы можно было логировать любые типы данных.
 */
export async function recordHistory(payload: HistoryPayload) {
  try {
    // Не записываем, если значения не изменились (глубокое сравнение не делаем, 
    // так как обычно это простые типы или объекты, приходящие из API)
    if (JSON.stringify(payload.oldValue) === JSON.stringify(payload.newValue)) {
      return;
    }

    await db.insert(changeHistory).values({
      projectId: payload.projectId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      field: payload.field,
      oldValue: payload.oldValue,
      newValue: payload.newValue,
      changedBy: payload.changedBy,
      source: payload.source || "MANUAL",
      changedAt: new Date(),
    });
    
    console.log(`[Audit] Recorded ${payload.entityType} change by user ${payload.changedBy}`);
  } catch (error) {
    // Логирование ошибки аудита не должно блокировать основную операцию, 
    // но мы выводим её в консоль для отладки.
    console.error("Failed to record audit history:", error);
  }
}
