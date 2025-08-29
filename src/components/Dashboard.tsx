import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Dashboard = () => {
  const stats = [
    {
      title: "Active Policies",
      value: "847",
      change: "+12%",
      icon: Shield,
      color: "text-primary",
      bgColor: "bg-primary/20"
    },
    {
      title: "Pending Reviews",
      value: "23",
      change: "-8%",
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/20"
    },
    {
      title: "Compliance Score",
      value: "94%",
      change: "+3%",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/20"
    },
    {
      title: "Threat Detections",
      value: "156",
      change: "+24%",
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/20"
    }
  ];

  const recentPolicies = [
    {
      service: "AWS Lambda",
      status: "Active",
      compliance: "CIS 3.1",
      lastUpdated: "2 hours ago",
      risk: "Low"
    },
    {
      service: "Azure Functions",
      status: "Pending Review",
      compliance: "CIS 2.4",
      lastUpdated: "4 hours ago",
      risk: "Medium"
    },
    {
      service: "GCP Cloud Run",
      status: "Draft",
      compliance: "CIS 4.2",
      lastUpdated: "6 hours ago",
      risk: "Low"
    }
  ];

  const threatAlerts = [
    {
      severity: "High",
      threat: "CVE-2024-8472",
      service: "Kubernetes",
      time: "15 min ago",
      status: "Investigating"
    },
    {
      severity: "Medium",
      threat: "Privilege Escalation",
      service: "IAM Roles",
      time: "2 hours ago",
      status: "Mitigated"
    },
    {
      severity: "Low",
      threat: "Config Drift",
      service: "S3 Buckets",
      time: "4 hours ago",
      status: "Resolved"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-success text-success-foreground";
      case "Pending Review": return "bg-warning text-warning-foreground";
      case "Draft": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Low": return "text-success";
      case "Medium": return "text-warning";
      case "High": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High": return "bg-destructive text-destructive-foreground";
      case "Medium": return "bg-warning text-warning-foreground";
      case "Low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="enterprise-card hover:shadow-glow-primary/20 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-success">{stat.change} from last month</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Policy Activity */}
        <Card className="enterprise-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Policy Activity
            </CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPolicies.map((policy, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{policy.service}</div>
                    <div className="text-sm text-muted-foreground">
                      {policy.compliance} • {policy.lastUpdated}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={`status-indicator ${getStatusColor(policy.status)}`}>
                      {policy.status}
                    </div>
                    <div className={`text-xs ${getRiskColor(policy.risk)}`}>
                      {policy.risk} Risk
                    </div>
                  </div>
                </div>
              ))}
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
              {threatAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{alert.threat}</div>
                    <div className="text-sm text-muted-foreground">
                      {alert.service} • {alert.time}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={`status-indicator ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {alert.status}
                    </div>
                  </div>
                </div>
              ))}
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