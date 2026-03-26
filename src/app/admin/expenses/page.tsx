import { Suspense } from "react";
import { ExpensesReport } from "@/components/reports/expenses-report";

export default function ExpensesPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<div>Загрузка отчета...</div>}>
        <ExpensesReport />
      </Suspense>
    </div>
  );
}
