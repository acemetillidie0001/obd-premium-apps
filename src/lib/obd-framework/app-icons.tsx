/**
 * OBD Premium Apps Icon Registry
 * 
 * Maps icon keys from apps.config.ts to Lucide React icon components.
 * Each icon is styled consistently with emerald-500 color and standard sizing.
 */

import React from "react";
import {
  MessageSquare,
  FileText,
  Share2,
  HelpCircle,
  PenTool,
  PencilLine,
  Image,
  Percent,
  Tag,
  Calendar,
  CalendarPlus,
  CalendarClock,
  Briefcase,
  BarChart3,
  MapPin,
  Search,
  FileCode,
  Code2,
  TrendingUp,
  Zap,
  Clock,
  Users,
  Palette,
  Sparkles,
  ShieldCheck,
  Send,
  Globe,
  Bot,
  Contact,
  Megaphone,
} from "lucide-react";

/**
 * Icon registry mapping icon keys to React components
 * All icons use consistent styling: w-5 h-5 text-[#29c4a9] (OBD teal)
 */
export const appIcons: Record<string, React.ReactNode> = {
  // Content & Writing Tools
  "message-square": <MessageSquare className="w-5 h-5 text-[#29c4a9]" />,
  "file-text": <FileText className="w-5 h-5 text-[#29c4a9]" />,
  "megaphone": <Megaphone className="w-5 h-5 text-[#29c4a9]" />,
  "help-circle": <HelpCircle className="w-5 h-5 text-[#29c4a9]" />,
  "pencil-line": <PencilLine className="w-5 h-5 text-[#29c4a9]" />,
  "image": <Image className="w-5 h-5 text-[#29c4a9]" />,
  "tag": <Tag className="w-5 h-5 text-[#29c4a9]" />,
  "calendar-plus": <CalendarPlus className="w-5 h-5 text-[#29c4a9]" />,
  "users": <Users className="w-5 h-5 text-[#29c4a9]" />,
  
  // Reputation & Reviews
  "shield-check": <ShieldCheck className="w-5 h-5 text-[#29c4a9]" />,
  "send": <Send className="w-5 h-5 text-[#29c4a9]" />,
  
  // Google Business & Local Search
  "map-pin": <MapPin className="w-5 h-5 text-[#29c4a9]" />,
  "search": <Search className="w-5 h-5 text-[#29c4a9]" />,
  
  // SEO Tools
  "globe": <Globe className="w-5 h-5 text-[#29c4a9]" />,
  "code-2": <Code2 className="w-5 h-5 text-[#29c4a9]" />,
  "bar-chart-3": <BarChart3 className="w-5 h-5 text-[#29c4a9]" />,
  
  // Productivity & Automation
  "share-2": <Share2 className="w-5 h-5 text-[#29c4a9]" />,
  "calendar-clock": <CalendarClock className="w-5 h-5 text-[#29c4a9]" />,
  "contact": <Contact className="w-5 h-5 text-[#29c4a9]" />,
  "bot": <Bot className="w-5 h-5 text-[#29c4a9]" />,
  
  // Design & Branding
  "sparkles": <Sparkles className="w-5 h-5 text-[#29c4a9]" />,
  "palette": <Palette className="w-5 h-5 text-[#29c4a9]" />,
  
  // Legacy/Alternative keys (for backward compatibility)
  "percent": <Tag className="w-5 h-5 text-[#29c4a9]" />,
  "pen-tool": <PencilLine className="w-5 h-5 text-[#29c4a9]" />,
};

/**
 * Get icon component for an app by icon key
 * Returns a React element that can be rendered directly
 */
export function getAppIcon(iconKey?: string): React.ReactNode {
  if (!iconKey) return null;
  return appIcons[iconKey] || null;
}