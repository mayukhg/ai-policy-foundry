import { useState } from "react";
import { Header } from "@/components/Header";
import { ExecutivePitch } from "@/components/ExecutivePitch";
import { Dashboard } from "@/components/Dashboard";
import { PolicyGenerator } from "@/components/PolicyGenerator";
import { ThreatIntelligence } from "@/components/ThreatIntelligence";

const Index = () => {
  const [currentPage, setCurrentPage] = useState("executive");

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
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="container mx-auto px-6 py-8">
        {renderPage()}
      </main>
    </div>
  );
};

export default Index;
