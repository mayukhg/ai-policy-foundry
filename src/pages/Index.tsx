import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Header } from "@/components/Header";
import { ExecutivePitch } from "@/components/ExecutivePitch";
import { Dashboard } from "@/components/Dashboard";
import { PolicyGenerator } from "@/components/PolicyGenerator";
import { ThreatIntelligence } from "@/components/ThreatIntelligence";
import { trackEvent } from "@/lib/mixpanel";
import { mapDashboardSection } from "@/lib/analyticsHelpers";

class PageErrorBoundary extends Component<
  { children: ReactNode; pageKey: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page render failed:", error, info);
  }

  componentDidUpdate(prevProps: { pageKey: string }) {
    if (prevProps.pageKey !== this.props.pageKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-foreground">
          <p className="font-semibold">This page failed to render.</p>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Index = () => {
  const [currentPage, setCurrentPage] = useState("executive");

  useEffect(() => {
    trackEvent("foundry_dashboard_viewed", {
      section: mapDashboardSection(currentPage),
      platform: "ai_policy_foundry",
    });
  }, [currentPage]);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "executive":
        return <ExecutivePitch />;
      case "dashboard":
        return <Dashboard />;
      case "generator":
        return <PolicyGenerator />;
      case "threat-intel":
        return <ThreatIntelligence />;
      default:
        return <ExecutivePitch />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="container mx-auto px-6 py-8">
        <PageErrorBoundary pageKey={currentPage}>{renderPage()}</PageErrorBoundary>
      </main>
    </div>
  );
};

export default Index;
