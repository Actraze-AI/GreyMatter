import { AppHeader } from "@/components/AppHeader";
import { DemoProcessingClient } from "@/components/DemoProcessingClient";

const demoId = process.env.DEMO_ANALYSIS_ID ?? "DVj0HP6CQOP";

export default function DemoProcessingPage() {
  return (
    <main className="min-h-screen">
      <AppHeader active="processing" />
      <DemoProcessingClient demoId={demoId} />
    </main>
  );
}
