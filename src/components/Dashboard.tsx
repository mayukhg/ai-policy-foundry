import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackEvent } from "@/lib/mixpanel";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const authHeaders = (): HeadersInit => ({
  Authorization: `Bearer ${localStorage.getItem("token") || "demo-token"}`,
});

interface OverviewStats {
  activePolicies?: number;
  pendingReviews?: number;
  complianceScore?: number;
  threatDetections?: number;
  agentStatus?: Record<
    string,
    { status: string; description?: string; lastActivity?: string }
  >;
}

interface PolicyRow {
  id?: string;
  service?: string;
  status?: string;
  compliance?: string | { framework?: string; status?: string; controls?: unknown };
  lastUpdated?: string;
  risk?: string;
}

function formatCompliance(compliance?: PolicyRow["compliance"]): string {
  if (!compliance) return "—";
  if (typeof compliance === "string") return compliance;
  return compliance.framework || compliance.status || "—";
}

interface DashboardAlert {
  id?: string;
  severity?: string;
  title?: string;
  message?: string;
  description?: string;
  timestamp?: string;
  status?: string;
}

interface ActivityItem {
  id?: string;
  type?: string;
  message?: string;
  timestamp?: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Request failed (${response.status})`);
  }
  const body = await response.json();
  return body.data as T;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function formatStatus(status?: string): string {
  if (!status) return "Unknown";
  const normalized = status.toLowerCase().replace(/_/g, " ");
  if (normalized === "approved") return "Active";
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRisk(risk?: string): string {
  if (!risk) return "Medium";
  return risk.charAt(0).toUpperCase() + risk.slice(1).toLowerCase();
}

function formatSeverity(severity?: string): string {
  if (!severity) return "Low";
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
}

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    trackEvent("foundry_dashboard_viewed", {
      section: "overview",
      platform: "ai_policy_foundry",
    });

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewData, activityData, alertsData, policiesData] = await Promise.all([
          fetchJson<OverviewStats>("/dashboard/overview"),
          fetchJson<ActivityItem[]>("/dashboard/recent-activity"),
          fetchJson<DashboardAlert[]>("/dashboard/alerts"),
          fetchJson<PolicyRow[]>("/policies"),
        ]);
        if (cancelled) return;
        setOverview(overviewData);
        setActivity(Array.isArray(activityData) ? activityData : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        setPolicies(Array.isArray(policiesData) ? policiesData.slice(0, 5) : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    {
      title: "Active Policies",
      value: overview?.activePolicies?.toString() ?? "—",
      icon: Shield,
      color: "text-primary",
      bgColor: "bg-primary/20",
    },
    {
      title: "Pending Reviews",
      value: overview?.pendingReviews?.toString() ?? "—",
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/20",
    },
    {
      title: "Compliance Score",
      value:
        overview?.complianceScore != null ? `${overview.complianceScore}%` : "—",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/20",
    },
    {
      title: "Threat Detections",
      value: overview?.threatDetections?.toString() ?? "—",
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/20",
    },
  ];

  const agentEntries = overview?.agentStatus
    ? Object.entries(overview.agentStatus)
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-success text-success-foreground";
      case "Pending Review":
        return "bg-warning text-warning-foreground";
      case "Draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Low":
        return "text-success";
      case "Medium":
        return "text-warning";
      case "High":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
      case "High":
        return "bg-destructive text-destructive-foreground";
      case "Medium":
        return "bg-warning text-warning-foreground";
      case "Low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="enterprise-card hover:shadow-glow-primary/20 transition-all duration-300"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">Live from API</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agentEntries.length > 0 && (
        <Card className="enterprise-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Agent Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentEntries.map(([name, info]) => (
                <div
                  key={name}
                  className="p-4 border border-border rounded-lg flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-medium text-foreground capitalize">
                      {name.replace(/-/g, " ")}
                    </div>
                    {info.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {info.description}
                      </div>
                    )}
                  </div>
                  <span
                    className={`status-indicator text-xs capitalize ${
                      info.status === "active" || info.status === "idle"
                        ? "bg-success text-success-foreground"
                        : info.status === "error"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {info.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Policy Activity */}
        <Card className="enterprise-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Policy Activity
            </CardTitle>
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No policies yet.</p>
              ) : (
                policies.map((policy) => {
                  const status = formatStatus(policy.status);
                  const risk = formatRisk(policy.risk);
                  return (
                    <div
                      key={policy.id || policy.service}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">
                          {policy.service || policy.id}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCompliance(policy.compliance)} •{" "}
                          {formatRelativeTime(policy.lastUpdated)}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className={`status-indicator ${getStatusColor(status)}`}>
                          {status}
                        </div>
                        <div className={`text-xs ${getRiskColor(risk)}`}>{risk} Risk</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Threat Intelligence Feed */}
        <Card className="enterprise-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Threat Intelligence Feed
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="pulse-dot bg-success"></div>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.length === 0 && activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active alerts.</p>
              ) : (
                <>
                  {alerts.map((alert) => {
                    const severity = formatSeverity(alert.severity);
                    return (
                      <div
                        key={alert.id || alert.title}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{alert.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {alert.message || alert.description} •{" "}
                            {formatRelativeTime(alert.timestamp)}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className={`status-indicator ${getSeverityColor(severity)}`}>
                            {severity}
                          </div>
                          {alert.status && (
                            <div className="text-xs text-muted-foreground capitalize">
                              {alert.status}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {activity.slice(0, 3).map((item) => (
                    <div
                      key={item.id || item.message}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors opacity-90"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-foreground text-sm">
                          {item.message}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {item.type?.replace(/_/g, " ")} •{" "}
                          {formatRelativeTime(item.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="enterprise-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto p-6 flex-col space-y-2">
              <Shield className="w-8 h-8 text-primary" />
              <span>Generate Policy</span>
            </Button>
            <Button variant="outline" className="h-auto p-6 flex-col space-y-2">
              <TrendingUp className="w-8 h-8 text-success" />
              <span>View Analytics</span>
            </Button>
            <Button variant="outline" className="h-auto p-6 flex-col space-y-2">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <span>Review Alerts</span>
            </Button>
            <Button variant="outline" className="h-auto p-6 flex-col space-y-2">
              <CheckCircle className="w-8 h-8 text-success" />
              <span>Compliance Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
