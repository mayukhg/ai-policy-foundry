import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Shield, TrendingUp, Eye, Clock, Globe } from "lucide-react";

export const ThreatIntelligence = () => {
  const threatFeeds = [
    {
      source: "NIST NVD",
      status: "Active",
      lastUpdate: "2 min ago",
      count: 23,
      severity: "High"
    },
    {
      source: "MITRE ATT&CK",
      status: "Active", 
      lastUpdate: "5 min ago",
      count: 15,
      severity: "Medium"
    },
    {
      source: "CISA Alerts",
      status: "Active",
      lastUpdate: "12 min ago",
      count: 8,
      severity: "Critical"
    },
    {
      source: "Cloud Security Alliance",
      status: "Active",
      lastUpdate: "18 min ago",
      count: 12,
      severity: "Low"
    }
  ];

  const recentThreats = [
    {
      id: "CVE-2024-8472",
      title: "Remote Code Execution in Kubernetes API Server",
      severity: "Critical",
      cvss: "9.8",
      affectedServices: ["Kubernetes", "Container Registry"],
      publishedDate: "2024-01-15",
      mitigationAvailable: true,
      policyUpdated: false
    },
    {
      id: "CVE-2024-8471", 
      title: "Privilege Escalation in AWS IAM",
      severity: "High",
      cvss: "8.4",
      affectedServices: ["IAM", "Lambda", "S3"],
      publishedDate: "2024-01-14",
      mitigationAvailable: true,
      policyUpdated: true
    },
    {
      id: "CVE-2024-8470",
      title: "Information Disclosure in Azure Functions",
      severity: "Medium", 
      cvss: "6.5",
      affectedServices: ["Azure Functions", "Key Vault"],
      publishedDate: "2024-01-13",
      mitigationAvailable: false,
      policyUpdated: false
    }
  ];

  const attackTechniques = [
    {
      technique: "T1078 - Valid Accounts",
      description: "Adversaries may obtain and abuse credentials of existing accounts",
      frequency: "Very High",
      trend: "Increasing",
      relatedPolicies: 12,
      lastSeen: "2 hours ago"
    },
    {
      technique: "T1190 - Exploit Public-Facing Application", 
      description: "Adversaries may attempt to exploit weaknesses in public applications",
      frequency: "High",
      trend: "Stable",
      relatedPolicies: 8,
      lastSeen: "4 hours ago"
    },
    {
      technique: "T1068 - Exploitation for Privilege Escalation",
      description: "Adversaries may exploit software vulnerabilities to escalate privileges",
      frequency: "Medium",
      trend: "Decreasing", 
      relatedPolicies: 15,
      lastSeen: "6 hours ago"
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-destructive/80 text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend.toLowerCase()) {
      case "increasing": return "text-destructive";
      case "stable": return "text-warning";
      case "decreasing": return "text-success";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">Threat Intelligence Center</h2>
        <p className="text-xl text-muted-foreground">Real-time threat monitoring and policy correlation</p>
      </div>

      {/* Live Feed Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {threatFeeds.map((feed, index) => (
          <Card key={index} className="enterprise-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">{feed.source}</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-xs text-success">Live</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">New Threats</span>
                  <Badge className={getSeverityColor(feed.severity)}>{feed.count}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last update: {feed.lastUpdate}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="vulnerabilities" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vulnerabilities">CVE Database</TabsTrigger>
          <TabsTrigger value="techniques">Attack Techniques</TabsTrigger>
          <TabsTrigger value="correlation">Policy Correlation</TabsTrigger>
        </TabsList>

        <TabsContent value="vulnerabilities" className="space-y-6">
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Recent Vulnerabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentThreats.map((threat, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-foreground">{threat.id}</h3>
                          <Badge className={getSeverityColor(threat.severity)}>
                            {threat.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">CVSS: {threat.cvss}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{threat.title}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Shield className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Affected Services:</span>
                        <div className="mt-1 space-x-1">
                          {threat.affectedServices.map((service, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Published:</span>
                        <div className="mt-1">{threat.publishedDate}</div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${threat.mitigationAvailable ? 'bg-success' : 'bg-destructive'}`}></div>
                          <span className="text-xs">Mitigation {threat.mitigationAvailable ? 'Available' : 'Pending'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${threat.policyUpdated ? 'bg-success' : 'bg-warning'}`}></div>
                          <span className="text-xs">Policy {threat.policyUpdated ? 'Updated' : 'Review Needed'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="techniques" className="space-y-6">
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                MITRE ATT&CK Techniques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attackTechniques.map((technique, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground">{technique.technique}</h3>
                        <p className="text-sm text-muted-foreground">{technique.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <TrendingUp className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Shield className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Frequency:</span>
                        <div className="mt-1 font-medium">{technique.frequency}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Trend:</span>
                        <div className={`mt-1 font-medium ${getTrendColor(technique.trend)}`}>
                          {technique.trend}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Related Policies:</span>
                        <div className="mt-1 font-medium">{technique.relatedPolicies}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Seen:</span>
                        <div className="mt-1">{technique.lastSeen}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-6">
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-success" />
                AI Policy Correlation Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Intelligent Threat Correlation</h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Our AI engine continuously analyzes threat intelligence feeds and correlates them with 
                  existing policies, automatically identifying coverage gaps and recommending updates.
                </p>
                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-1">Real-time Analysis</h4>
                    <p className="text-sm text-muted-foreground">Continuous monitoring of 15+ threat feeds</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="w-6 h-6 text-secondary" />
                    </div>
                    <h4 className="font-semibold mb-1">Gap Identification</h4>
                    <p className="text-sm text-muted-foreground">Automatically detect policy coverage gaps</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <h4 className="font-semibold mb-1">Smart Recommendations</h4>
                    <p className="text-sm text-muted-foreground">AI-powered policy update suggestions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};