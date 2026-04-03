/**
 * Универсальный парсер дат для работы с данными.
 * Корректно обрабатывает российский формат DD.MM.YYYY HH:mm:ss
 * и возвращает дату в контексте Московского времени (UTC+3).
 */
export function parseFlexibleDate(dateStr: string | any): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  const s = String(dateStr).trim();
  
  // 1. Попытка распарсить российский формат DD.MM.YYYY [HH:mm:ss]
  if (s.includes('.')) {
    const parts = s.split(' ');
    const datePart = parts[0]; 
    const timePart = parts[1] || "00:00:00";
    
    const dParts = datePart.split('.');
    if (dParts.length === 3) {
      const day = parseInt(dParts[0], 10);
      const month = parseInt(dParts[1], 10) - 1; 
      const year = parseInt(dParts[2], 10);
      
      const tParts = timePart.split(':');
      const hours = parseInt(tParts[0] || "0", 10);
      const minutes = parseInt(tParts[1] || "0", 10);
      const seconds = parseInt(tParts[2] || "0", 10);
      
      // Создаем дату как UTC и вычитаем 3 часа, чтобы получить "Московское время в UTC"
      // Т.е. если в строке 01:00 МСК, в UTC это должно быть 22:00 вчерашнего дня
      const date = new Date(Date.UTC(year, month, day, hours - 3, minutes, seconds));
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // 2. Если формат ISO (Y-M-D)
  const standardDate = new Date(s);
  if (!isNaN(standardDate.getTime())) {
    // Если в строке нет смещения (Z или +HH:mm), считаем её московской
    if (!s.includes('Z') && !s.includes('+') && !s.includes('T')) {
        return new Date(standardDate.getTime() - 3 * 3600 * 1000);
    }
    return standardDate;
  }
  
  return new Date();
}

/**
 * Возвращает границы суток в UTC для заданного дня по Московскому времени (UTC+3).
 * Пример: для "2026-01-14" вернет:
 * start: 2026-01-13 21:00:00 UTC
 * end:   2026-01-14 20:59:59 UTC
 */
export function getMoscowDateRange(dateStr: string) {
    if (!dateStr) return null;
    
    let y, m, d;
    if (dateStr.includes('-')) {
        [y, m, d] = dateStr.split('-').map(Number);
    } else if (dateStr.includes('.')) {
        const parts = dateStr.split('.');
        [d, m, y] = parts.map(Number);
    } else {
        const dt = new Date(dateStr);
        y = dt.getFullYear();
        m = dt.getMonth() + 1;
        d = dt.getDate();
    }

    const start = new Date(Date.UTC(y, m - 1, d, 0 - 3, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, d, 23 - 3, 59, 59, 999));
    
    return { start, end };
}
