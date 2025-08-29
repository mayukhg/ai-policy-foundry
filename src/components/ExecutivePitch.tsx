import { Shield, TrendingUp, Clock, DollarSign, CheckCircle, AlertTriangle, Users, Target, Zap, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import heroBackground from "@/assets/hero-background.jpg";

export const ExecutivePitch = () => {
  const keyMetrics = [
    { label: "Time Reduction", value: "70%", icon: Clock, color: "text-success", bgColor: "bg-success/20" },
    { label: "Policy Speed", value: "<24hrs", icon: TrendingUp, color: "text-primary", bgColor: "bg-primary/20" },
    { label: "Compliance", value: "94%", icon: CheckCircle, color: "text-success", bgColor: "bg-success/20" },
    { label: "Cost Savings", value: "$2.4M", icon: DollarSign, color: "text-warning", bgColor: "bg-warning/20" },
  ];

  const executiveHighlights = [
    {
      title: "Strategic Risk Reduction",
      description: "Eliminate manual policy gaps that expose BP to $10M+ annual cyber risk",
      impact: "99.7% threat coverage",
      icon: Shield,
      color: "text-destructive"
    },
    {
      title: "Operational Excellence",
      description: "Free security engineers from policy boilerplate to focus on strategic threats",
      impact: "60% productivity gain",
      icon: Users,
      color: "text-primary"
    },
    {
      title: "Regulatory Compliance",
      description: "Automated mapping to CIS, NIST, and industry frameworks",
      impact: "100% audit readiness",
      icon: Target,
      color: "text-success"
    },
    {
      title: "Future-Proof Architecture",
      description: "Multi-agent AI scales with cloud provider innovation velocity",
      impact: "∞ scalability",
      icon: Zap,
      color: "text-secondary"
    }
  ];

  const problemPoints = [
    {
      title: "Scale Crisis",
      description: "Cloud providers release 200+ new features monthly. Manual policy creation takes weeks per service.",
      impact: "30-60 day security gaps",
      severity: "critical"
    },
    {
      title: "Threat Velocity",
      description: "New attack vectors emerge weekly. Static policies can't adapt to dynamic threats.",
      impact: "Zero-day vulnerabilities",
      severity: "high"
    },
    {
      title: "Resource Drain",
      description: "Senior security engineers spend 70% of time on policy boilerplate instead of strategic defense.",
      impact: "$500K/year waste",
      severity: "medium"
    },
    {
      title: "Compliance Risk",
      description: "One-size-fits-all policies fail to address BP's unique operational context and regulatory requirements.",
      impact: "Audit failures",
      severity: "high"
    }
  ];

  const roiBreakdown = [
    { category: "Security Staff Efficiency", saving: "$1.2M", description: "70% reduction in manual policy work" },
    { category: "Incident Reduction", saving: "$800K", description: "90% faster response to new threats" },
    { category: "Compliance Automation", saving: "$300K", description: "Automated audit preparation" },
    { category: "Cloud Innovation", saving: "$100K", description: "Faster service adoption cycles" }
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section with Animation */}
      <section 
        className="hero-section min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/80 to-background/90"></div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full animate-float"></div>
        <div className="absolute bottom-32 right-16 w-16 h-16 bg-secondary/20 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-12 h-12 bg-success/20 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <div className="space-y-8 animate-fade-in">
            <Badge className="px-6 py-2 text-sm font-semibold bg-primary/20 text-primary border-primary/30">
              Executive Briefing • Confidential
            </Badge>
            
            <div className="space-y-6">
              <h1 className="text-6xl lg:text-7xl font-bold text-foreground leading-tight">
                AI Policy
                <span className="bg-gradient-primary bg-clip-text text-transparent"> Foundry</span>
              </h1>
              <p className="text-2xl lg:text-3xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
                Transform BP's Cloud Security Posture with 
                <span className="text-primary font-semibold"> Autonomous Policy Intelligence</span>
              </p>
            </div>
            
            {/* Executive Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {keyMetrics.map((metric, index) => (
                <div 
                  key={index} 
                  className="metric-card animate-scale-in hover:animate-pulse-glow transition-all duration-300"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className={`p-4 rounded-full ${metric.bgColor} w-fit mx-auto mb-4`}>
                    <metric.icon className={`w-8 h-8 ${metric.color}`} />
                  </div>
                  <div className="text-3xl lg:text-4xl font-bold text-foreground">{metric.value}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">{metric.label}</div>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center mt-12">
              <Button variant="hero" size="lg" className="text-lg px-8 py-4 animate-pulse-glow">
                <BarChart className="w-6 h-6" />
                Request Executive Demo
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                <DollarSign className="w-6 h-6" />
                Download ROI Analysis
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Executive Summary */}
      <section className="container mx-auto px-6">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">Executive Summary</h2>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            BP faces an unprecedented challenge: cloud security policies that can't match the velocity of 
            digital transformation. AI Policy Foundry solves this with autonomous, intelligent policy generation.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {executiveHighlights.map((highlight, index) => (
            <Card 
              key={index} 
              className="enterprise-card border-primary/20 hover:border-primary/40 transition-all duration-300 animate-slide-in-right"
              style={{ animationDelay: `${index * 0.3}s` }}
            >
              <CardContent className="p-8">
                <div className="flex items-start gap-6">
                  <div className={`p-4 rounded-lg bg-card border border-border`}>
                    <highlight.icon className={`w-8 h-8 ${highlight.color}`} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground">{highlight.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{highlight.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-semibold">
                        {highlight.impact}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Problem Statement - Executive Level */}
      <section className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-6">The $10M Risk</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Current manual policy management exposes BP to significant cyber risk and operational inefficiency
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {problemPoints.map((problem, index) => (
            <Card 
              key={index} 
              className="enterprise-card border-destructive/30 hover:shadow-glow-primary/20 transition-all duration-300"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                  {problem.title}
                  <Badge className={
                    problem.severity === 'critical' ? 'bg-destructive text-destructive-foreground' :
                    problem.severity === 'high' ? 'bg-destructive/80 text-destructive-foreground' :
                    'bg-warning text-warning-foreground'
                  }>
                    {problem.severity}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4 leading-relaxed">{problem.description}</p>
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <span className="text-sm font-semibold text-destructive">Business Impact: </span>
                  <span className="text-sm text-foreground">{problem.impact}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ROI Breakdown */}
      <section className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-6">Financial Impact</h2>
          <p className="text-xl text-muted-foreground">
            Conservative 12-month ROI projection: <span className="text-success font-bold">312%</span>
          </p>
        </div>

        <Card className="enterprise-card bg-gradient-card border-success/30">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-6">Annual Cost Savings</h3>
                <div className="space-y-4">
                  {roiBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-card/50 rounded-lg border border-border">
                      <div>
                        <div className="font-semibold text-foreground">{item.category}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                      <div className="text-xl font-bold text-success">{item.saving}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Total Annual Savings</span>
                    <span className="text-2xl font-bold text-success">$2.4M</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Implementation Investment</h4>
                  <div className="text-3xl font-bold text-primary">$650K</div>
                  <div className="text-sm text-muted-foreground">One-time setup and integration</div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Payback Period</h4>
                  <div className="text-3xl font-bold text-warning">3.9 months</div>
                  <div className="text-sm text-muted-foreground">Break-even point</div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-foreground mb-3">3-Year NPV</h4>
                  <div className="text-3xl font-bold text-success">$6.2M</div>
                  <div className="text-sm text-muted-foreground">Conservative estimate</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Call to Action - Executive */}
      <section className="container mx-auto px-6 text-center">
        <Card className="enterprise-card bg-gradient-hero border-primary/30 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5"></div>
          <CardContent className="relative pt-16 pb-16">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
                  Ready to Secure BP's Digital Future?
                </h2>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Join industry leaders who've transformed their security posture with AI-driven policy automation. 
                  The question isn't whether to automate—it's how quickly you can gain the competitive advantage.
                </p>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-6 justify-center items-center">
                <Button variant="hero" size="lg" className="text-xl px-12 py-6 animate-pulse-glow">
                  <Shield className="w-6 h-6" />
                  Schedule C-Suite Demo
                </Button>
                <Button variant="outline" size="lg" className="text-xl px-12 py-6">
                  <BarChart className="w-6 h-6" />
                  Request Detailed Business Case
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Next available executive briefing slot: <span className="text-primary font-semibold">This Thursday, 2:00 PM</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};