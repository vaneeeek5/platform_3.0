import { db } from "./src/db";
import { leads } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function verify() {
  const clientId = "1769763182217668886";
  const result = await db.select().from(leads).where(eq(leads.metrikaClientId, clientId)).limit(1);
  
  if (result.length > 0) {
    const lead = result[0];
    console.log("--- ВЕРИФИКАЦИЯ ДАТЫ В БАЗЕ ---");
    console.log("Client ID:", lead.metrikaClientId);
    console.log("Дата как объект в JS:", lead.date);
    console.log("Дата в ISO формате (UTC):", lead.date.toISOString());
    console.log("Дата в читаемом формате (RU):", lead.date.toLocaleString("ru-RU"));
    
    // Пояснение
    const month = lead.date.getMonth() + 1;
    if (month === 12) {
        console.log("\nРЕЗУЛЬТАТ: Лид записан на ДЕКАБРЬ (12 месяц).");
        console.log("Вероятная причина: В файле было '12' число, но система восприняла это как '12' месяц.");
    }
  } else {
    console.log("Лид с ClientID 1769763182217668886 не найден.");
  }
  process.exit(0);
}

verify();
