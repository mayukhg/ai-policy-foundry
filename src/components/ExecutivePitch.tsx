import { Shield, TrendingUp, Clock, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import heroBackground from "@/assets/hero-background.jpg";

export const ExecutivePitch = () => {
  const metrics = [
    { label: "Time Reduction", value: "60-70%", icon: Clock, color: "text-success" },
    { label: "Policy Generation", value: "<24hrs", icon: TrendingUp, color: "text-primary" },
    { label: "Compliance Alignment", value: "90%", icon: CheckCircle, color: "text-success" },
    { label: "Cost Savings", value: "$2.4M", icon: DollarSign, color: "text-warning" },
  ];

  const challenges = [
    "Manual policy creation takes weeks per service",
    "Hundreds of new cloud features released annually",
    "Threat landscape evolves weekly",
    "One-size-fits-all policies lack context"
  ];

  const solutions = [
    "Auto-generate policies within 24 hours",
    "AI agents parse provider docs continuously",
    "Real-time threat intel correlation",
    "Personalized policies based on telemetry"
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section 
        className="hero-section min-h-[60vh] flex items-center justify-center text-center relative"
        style={{
          backgroundImage: `url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/90"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-foreground">
              AI Policy Foundry
            </h1>
            <p className="text-xl text-muted-foreground">
              Transforming Cloud Security Policy Management for BP
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <div key={index} className="metric-card text-center">
                <metric.icon className={`w-8 h-8 ${metric.color} mx-auto mb-2`} />
                <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg">
              <Shield className="w-5 h-5" />
              View Live Demo
            </Button>
            <Button variant="outline" size="lg">
              Download Business Case
            </Button>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12">
          <Card className="enterprise-card border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Current Challenges
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {challenges.map((challenge, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                  <p className="text-muted-foreground">{challenge}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="enterprise-card border-success/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle className="w-5 h-5" />
                AI-Powered Solutions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {solutions.map((solution, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0"></div>
                  <p className="text-muted-foreground">{solution}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Business Value */}
      <section className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Business Impact</h2>
          <p className="text-xl text-muted-foreground">Measurable results for BP's cloud security strategy</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="enterprise-card text-center">
            <CardContent className="pt-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Operational Efficiency</h3>
              <p className="text-muted-foreground">Security engineers focus on high-value risk analysis instead of policy boilerplate</p>
            </CardContent>
          </Card>

          <Card className="enterprise-card text-center">
            <CardContent className="pt-8">
              <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Risk Reduction</h3>
              <p className="text-muted-foreground">Continuous policy updates ensure protection against emerging threats</p>
            </CardContent>
          </Card>

          <Card className="enterprise-card text-center">
            <CardContent className="pt-8">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Compliance Assurance</h3>
              <p className="text-muted-foreground">Automated mapping to CIS benchmarks and BP baseline controls</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="container mx-auto px-6 text-center">
        <Card className="enterprise-card bg-gradient-card border-primary/30">
          <CardContent className="pt-12 pb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Security Posture?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join the future of cloud security policy management with AI-driven automation and continuous protection.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg">
                Schedule Executive Demo
              </Button>
              <Button variant="outline" size="lg">
                Request ROI Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};