import { Suspense } from "react";
import { PageContainer, Eyebrow, Display } from "@/components/ui";
import WallInner from "@/components/wall/wall-inner";

export default function WallPage() {
  return (
    <PageContainer className="space-y-6 py-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>The Wall · הקיר</Eyebrow>
          <Display className="mt-2 !text-[clamp(34px,5vw,56px)]">
            הקיר <span className="trend-up-glow">המשותף.</span>
          </Display>
        </div>
        <p className="text-sm text-[var(--fg-dim)] max-w-xs leading-relaxed">
          כל פוזיציה פתוחה מטפסת על קיר אחד. הגובה = אחוז מהכניסה.
          חבל יורד לעוגן הסטופ — נגע בו, המטפס נופל.
        </p>
      </section>

      <Suspense fallback={<div className="shimmer rounded-2xl h-[70vh] w-full" />}>
        <WallInner />
      </Suspense>
    </PageContainer>
  );
}
