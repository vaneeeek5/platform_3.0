import { Suspense } from "react";
import { ExpensesReport } from "@/components/reports/expenses-report";

export default function ExpensesPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
          Расходы
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">Анализ маркетинговых затрат и эффективности.</p>
      </div>

      <Suspense fallback={
        <div className="p-10 flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">Загрузка отчета...</p>
        </div>
      }>
        <ExpensesReport />
      </Suspense>
    </div>
  );
}
