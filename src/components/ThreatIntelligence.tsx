import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, TrendingUp, Eye, Clock, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { trackEvent } from "@/lib/mixpanel";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const authHeaders = (json = false): HeadersInit => ({
  Authorization: `Bearer ${localStorage.getItem("token") || "demo-token"}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

interface PolicyDecision {
  action?: string;
  confidence?: number;
  reasoning?: string;
  relatedPolicyIds?: string[];
  decision?: { action?: string };
}

interface ThreatItem {
  id: string;
  title: string;
  severity: string;
  status?: string;
  description?: string;
  service?: string;
  cve?: string | null;
  detectedAt?: string;
  publishedDate?: string;
  affectedServices?: string[];
  cvss?: string | number;
  mitigationAvailable?: boolean;
  policyUpdated?: boolean;
  policyDecision?: PolicyDecision;
}

interface ThreatFeed {
  source: string;
  status: string;
  lastUpdate: string;
  count: number;
  severity: string;
}

const attackTechniques = [
  {
    technique: "T1078 - Valid Accounts",
    description: "Adversaries may obtain and abuse credentials of existing accounts",
    frequency: "Very High",
    trend: "Increasing",
    relatedPolicies: 12,
    lastSeen: "2 hours ago",
  },
  {
    technique: "T1190 - Exploit Public-Facing Application",
    description: "Adversaries may attempt to exploit weaknesses in public applications",
    frequency: "High",
    trend: "Stable",
    relatedPolicies: 8,
    lastSeen: "4 hours ago",
  },
  {
    technique: "T1068 - Exploitation for Privilege Escalation",
    description: "Adversaries may exploit software vulnerabilities to escalate privileges",
    frequency: "Medium",
    trend: "Decreasing",
    relatedPolicies: 15,
    lastSeen: "6 hours ago",
  },
];

function formatRelativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hours ago`;
  return new Date(iso).toLocaleDateString();
}

function formatLabel(value?: string): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function decisionLabel(decision?: PolicyDecision): string {
  if (!decision) return "—";
  const action =
    decision.action ||
    decision.decision?.action ||
    "";
  return action.replace(/_/g, " ");
}

export const ThreatIntelligence = () => {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [feeds, setFeeds] = useState<ThreatFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, PolicyDecision>>({});
  const { toast } = useToast();

  useEffect(() => {
    trackEvent("foundry_dashboard_viewed", {
      section: "audit",
      platform: "ai_policy_foundry",
    });

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [threatsRes, feedsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/threats`, { headers: authHeaders() }),
          fetch(`${API_BASE_URL}/threats/feeds/status`, { headers: authHeaders() }),
        ]);

        if (!threatsRes.ok) {
          const err = await threatsRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to load threats");
        }
        const threatsBody = await threatsRes.json();
        if (!cancelled) {
          setThreats(Array.isArray(threatsBody.data) ? threatsBody.data : []);
        }

        if (feedsRes.ok) {
          const feedsBody = await feedsRes.json();
          if (!cancelled && Array.isArray(feedsBody.data)) {
            setFeeds(feedsBody.data);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load threat data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePolicyDecision = async (threat: ThreatItem) => {
    setDecisionLoadingId(threat.id);
    try {
      const response = await fetch(`${API_BASE_URL}/threats/policy-decision`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ threat, service: threat.service }),
      });

      if (!response.ok) {
        if (threat.policyDecision) {
          setDecisions((prev) => ({ ...prev, [threat.id]: threat.policyDecision! }));
          toast({
            title: "Using seeded policy decision",
            description: decisionLabel(threat.policyDecision),
          });
          return;
        }
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Policy decision request failed");
      }

      const result = await response.json();
      const decision = result.data as PolicyDecision;
      setDecisions((prev) => ({ ...prev, [threat.id]: decision }));

      const severity =
        threat.severity === "critical" || threat.severity === "high" || threat.severity === "medium" || threat.severity === "low"
          ? threat.severity
          : "medium";
      trackEvent("policy_violation_reported", {
        violation_id: crypto.randomUUID(),
        policy_id: decision.relatedPolicyIds?.[0] || "threat-policy",
        asset_id: threat.service || threat.id,
        severity,
        detection_source: "ai_soc",
        auto_remediated: (decision.action || decision.decision?.action || "")
          .toLowerCase()
          .includes("auto"),
      });
      trackEvent("compliance_check_run", {
        check_id: crypto.randomUUID(),
        policy_id: decision.relatedPolicyIds?.[0] || "threat-policy",
        framework: "custom",
        asset_id: threat.service || threat.id,
        asset_type: "api_endpoint",
        triggered_by: "event_triggered",
      });

      toast({
        title: "Policy recommendation",
        description: result.message || decisionLabel(decision),
      });
    } catch (e) {
      if (threat.policyDecision) {
        setDecisions((prev) => ({ ...prev, [threat.id]: threat.policyDecision! }));
        toast({
          title: "Using seeded policy decision",
          description: decisionLabel(threat.policyDecision),
        });
      } else {
        toast({
          title: "Decision failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setDecisionLoadingId(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-destructive text-destructive-foreground";
      case "high":
        return "bg-destructive/80 text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend.toLowerCase()) {
      case "increasing":
        return "text-destructive";
      case "stable":
        return "text-warning";
      case "decreasing":
        return "text-success";
      default:
        return "text-muted-foreground";
    }
  };

  const displayFeeds: ThreatFeed[] =
    feeds.length > 0
      ? feeds
      : [
          { source: "Threat API", status: "active", lastUpdate: new Date().toISOString(), count: threats.length, severity: "high" },
        ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading threat intelligence…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">Threat Intelligence Center</h2>
        <p className="text-xl text-muted-foreground">
          Real-time threat monitoring and policy correlation
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Live Feed Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayFeeds.map((feed, index) => (
          <Card key={index} className="enterprise-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">{feed.source}</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-xs text-success capitalize">{feed.status}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">New Threats</span>
                  <Badge className={getSeverityColor(feed.severity)}>{feed.count}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last update: {formatRelativeTime(feed.lastUpdate)}
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
                {threats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No threats reported.</p>
                ) : (
                  threats.map((threat) => {
                    const resolvedDecision = decisions[threat.id] || threat.policyDecision;
                    const displayId = threat.cve || threat.id;
                    const services =
                      threat.affectedServices ||
                      (threat.service ? [threat.service] : []);
                    const published =
                      threat.publishedDate || threat.detectedAt;

                    return (
                      <div
                        key={threat.id}
                        className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-semibold text-foreground">{displayId}</h3>
                              <Badge className={getSeverityColor(threat.severity)}>
                                {formatLabel(threat.severity)}
                              </Badge>
                              {threat.status && (
                                <Badge variant="outline" className="capitalize">
                                  {formatLabel(threat.status)}
                                </Badge>
                              )}
                              {threat.cvss != null && (
                                <span className="text-sm text-muted-foreground">
                                  CVSS: {threat.cvss}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground font-medium">{threat.title}</p>
                            {threat.description && (
                              <p className="text-sm text-muted-foreground">{threat.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button variant="ghost" size="sm" type="button">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              disabled={decisionLoadingId === threat.id}
                              onClick={() => handlePolicyDecision(threat)}
                            >
                              {decisionLoadingId === threat.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Affected Services:</span>
                            <div className="mt-1 space-x-1 flex flex-wrap gap-1">
                              {services.map((service, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {service}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Detected:</span>
                            <div className="mt-1">{formatRelativeTime(published)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Policy decision:</span>
                            <div className="mt-1 capitalize">
                              {decisionLabel(resolvedDecision)}
                            </div>
                            {resolvedDecision?.reasoning && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {resolvedDecision.reasoning}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
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
                  <div
                    key={index}
                    className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors"
                  >
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
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Intelligent Threat Correlation
                </h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Our AI engine continuously analyzes threat intelligence feeds and correlates them
                  with existing policies, automatically identifying coverage gaps and recommending
                  updates.
                </p>
                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-1">Real-time Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Continuous monitoring of 15+ threat feeds
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="w-6 h-6 text-secondary" />
                    </div>
                    <h4 className="font-semibold mb-1">Gap Identification</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically detect policy coverage gaps
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <h4 className="font-semibold mb-1">Smart Recommendations</h4>
                    <p className="text-sm text-muted-foreground">
                      AI-powered policy update suggestions
                    </p>
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
