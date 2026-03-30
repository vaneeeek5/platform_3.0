/**
 * Универсальный парсер дат для работы с CRM данными.
 * Корректно обрабатывает российский формат DD.MM.YYYY HH:mm:ss,
 * с которым обычный new Date() часто ошибается (принимает за MM.DD).
 */
export function parseFlexibleDate(dateStr: string | any): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  const s = String(dateStr).trim();
  
  // 1. Попытка распарсить российский формат DD.MM.YYYY [HH:mm:ss]
  if (s.includes('.')) {
    const parts = s.split(' ');
    const datePart = parts[0]; // "DD.MM.YYYY"
    const timePart = parts[1] || "00:00:00"; // "HH:mm:ss"
    
    const dParts = datePart.split('.');
    if (dParts.length === 3) {
      const day = parseInt(dParts[0], 10);
      const month = parseInt(dParts[1], 10) - 1; // в JS месяцы 0-11
      const year = parseInt(dParts[2], 10);
      
      const tParts = timePart.split(':');
      const hours = parseInt(tParts[0] || "0", 10);
      const minutes = parseInt(tParts[1] || "0", 10);
      const seconds = parseInt(tParts[2] || "0", 10);
      
      const date = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // 2. Если формат другой (ISO или ММ/DD), пробуем стандартный парсер
  const standardDate = new Date(s);
  if (!isNaN(standardDate.getTime())) return standardDate;
  
  // Резервный вариант - текущая дата
  return new Date();
}
