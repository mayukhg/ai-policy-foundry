import { Shield, Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Header = ({ currentPage, onNavigate }: HeaderProps) => {
  const navItems = [
    { id: "executive", label: "Executive Pitch", icon: Shield },
    { id: "dashboard", label: "Dashboard", icon: Menu },
    { id: "generator", label: "Policy Generator", icon: Shield },
    { id: "threat-intel", label: "Threat Intelligence", icon: Bell },
  ];

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <img src={logo} alt="AI Policy Foundry" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">AI Policy Foundry</h1>
            <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full font-medium">
              BP Cloud Security
            </span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={currentPage === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onNavigate(item.id)}
                className="flex items-center space-x-2"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Bell className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};