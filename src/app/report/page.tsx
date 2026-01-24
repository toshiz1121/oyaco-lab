import { ParentReport } from "@/components/ParentReport";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ReportPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
            <Link href="/">
                <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">保護者向けレポート</h1>
        </div>
        
        <p className="text-slate-600">
            お子様の学習の様子や興味関心を確認できます。
        </p>

        <ParentReport />
      </div>
    </main>
  );
}
