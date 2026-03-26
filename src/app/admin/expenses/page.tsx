import { Suspense } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ExpensesReport } from "@/components/reports/expenses-report";

export default function ExpensesPage() {
  return (
    <AdminLayout title="Расходы и отчеты">
      <div className="p-6">
        <Suspense fallback={<div>Загрузка отчета...</div>}>
          <ExpensesReport />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
