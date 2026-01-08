"use client";

import { useState } from "react";
import Link from "next/link";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import {
  User,
  CreditCard,
  Users,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  Gift,
  Calendar,
  Briefcase,
  Star,
  BarChart3,
  Bot,
  MapPin,
  Search,
  Globe,
  FileCode,
  Database,
  TrendingUp,
  Zap,
  Clock,
  Building2,
  Palette,
  Sparkles,
} from "lucide-react";

interface AppTile {
  title: string;
  description: string;
  href?: string;
  buttonLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

interface AppSection {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tiles: AppTile[];
}

const APP_SECTIONS: AppSection[] = [
  {
    title: "My Account",
    description: "Manage your account settings and preferences",
    icon: User,
    tiles: [
      {
        title: "Brand Profile",
        description: "View and edit your brand identity and settings",
        href: "/apps/brand-profile",
        buttonLabel: "View / Edit Brand Profile",
        icon: User,
      },
      {
        title: "Billing & Plan",
        description: "Manage your subscription and billing information",
        buttonLabel: "Coming Soon",
        icon: CreditCard,
        comingSoon: true,
      },
      {
        title: "Team & Users",
        description: "Manage team members and user access",
        buttonLabel: "Coming Soon",
        icon: Users,
        comingSoon: true,
      },
    ],
  },
  {
    title: "Content & Writing Tools",
    description: "Create compelling content for your business",
    icon: FileText,
    tiles: [
      {
        title: "AI Review Responder",
        description: "Generate professional responses to customer reviews",
        href: "/apps/review-responder",
        buttonLabel: "Write a Reply",
        icon: MessageSquare,
      },
      {
        title: "AI Business Description Writer",
        description: "Craft professional business descriptions",
        href: "/apps/business-description-writer",
        buttonLabel: "Create Description",
        icon: FileText,
      },
      {
        title: "AI Social Media Post Creator",
        description: "Create eye-catching social media posts",
        href: "/apps/social-media-post-creator",
        buttonLabel: "Create Posts",
        icon: ImageIcon,
      },
      {
        title: "AI FAQ Generator",
        description: "Create comprehensive FAQ sections",
        href: "/apps/faq-generator",
        buttonLabel: "Generate FAQs",
        icon: HelpCircle,
      },
      {
        title: "AI Content Writer",
        description: "Generate blog posts, service pages, and more",
        href: "/apps/content-writer",
        buttonLabel: "Start Writing",
        icon: FileText,
      },
      {
        title: "AI Image Caption Generator",
        description: "Generate engaging captions for images",
        href: "/apps/image-caption-generator",
        buttonLabel: "Write Captions",
        icon: ImageIcon,
      },
      {
        title: "Offers & Promotions Builder",
        description: "Create compelling promotional offers",
        href: "/apps/offers-builder",
        buttonLabel: "Create Promo",
        icon: Gift,
      },
      {
        title: "Event Campaign Builder",
        description: "Build engaging event marketing campaigns",
        href: "/apps/event-campaign-builder",
        buttonLabel: "Create Campaign",
        icon: Calendar,
      },
      {
        title: "Local Hiring Assistant",
        description: "Generate job postings and hiring content",
        href: "/apps/local-hiring-assistant",
        buttonLabel: "Open Tool",
        icon: Briefcase,
      },
    ],
  },
  {
    title: "Reputation & Reviews",
    description: "Manage and improve your online reputation",
    icon: Star,
    tiles: [
      {
        title: "Reputation Dashboard",
        description: "Monitor and analyze your online reviews",
        href: "/apps/reputation-dashboard",
        buttonLabel: "Open Dashboard",
        icon: BarChart3,
      },
      {
        title: "Review Request Automation",
        description: "Automatically request reviews from customers",
        href: "/apps/review-request-automation",
        buttonLabel: "Open Tool",
        icon: Bot,
      },
    ],
  },
  {
    title: "Google Business & Local Search",
    description: "Optimize your Google Business Profile and local presence",
    icon: MapPin,
    tiles: [
      {
        title: "Google Business Profile Pro",
        description: "Advanced Google Business Profile management",
        href: "/apps/google-business-pro",
        buttonLabel: "Open Tool",
        icon: Globe,
      },
      {
        title: "Local Keyword Research Tool",
        description: "Discover high-value local keywords",
        href: "/apps/local-keyword-research",
        buttonLabel: "Open Tool",
        icon: Search,
      },
    ],
  },
  {
    title: "SEO Tools",
    description: "Improve your search engine visibility",
    icon: TrendingUp,
    tiles: [
      {
        title: "Local SEO Page Builder",
        description: "Create optimized local landing pages",
        href: "/apps/local-seo-page-builder",
        buttonLabel: "Build SEO Page",
        icon: FileCode,
      },
      {
        title: "Business Schema Generator",
        description: "Generate structured data for your business",
        href: "/apps/business-schema-generator",
        buttonLabel: "Generate Schema",
        icon: Database,
      },
      {
        title: "SEO Audit & Roadmap",
        description: "Get a comprehensive SEO improvement plan",
        href: "/apps/seo-audit-roadmap",
        buttonLabel: "Run SEO Audit",
        icon: TrendingUp,
      },
    ],
  },
  {
    title: "Productivity & Automation",
    description: "Streamline your business operations",
    icon: Zap,
    tiles: [
      {
        title: "OBD Social Auto-Poster",
        description: "Automate social media posting",
        href: "/apps/social-auto-poster",
        buttonLabel: "Open Tool",
        icon: Zap,
      },
      {
        title: "OBD Scheduler & Booking",
        description: "Schedule appointments and manage bookings",
        href: "/apps/obd-scheduler",
        buttonLabel: "Open Scheduler",
        icon: Clock,
      },
      {
        title: "OBD CRM",
        description: "Manage customer relationships and contacts",
        href: "/apps/obd-crm",
        buttonLabel: "Open CRM",
        icon: Building2,
      },
      {
        title: "AI Help Desk",
        description: "Intelligent customer support automation",
        href: "/apps/ai-help-desk",
        buttonLabel: "Open Help Desk",
        icon: HelpCircle,
      },
    ],
  },
  {
    title: "Design & Branding",
    description: "Create stunning visuals and build your brand",
    icon: Palette,
    tiles: [
      {
        title: "AI Logo Generator",
        description: "Generate custom logos with AI",
        href: "/apps/ai-logo-generator",
        buttonLabel: "Generate Logos",
        icon: Sparkles,
      },
      {
        title: "Brand Kit Builder",
        description: "Create comprehensive brand guidelines",
        href: "/apps/brand-kit-builder",
        buttonLabel: "Build Brand Kit",
        icon: Palette,
      },
    ],
  },
];

export default function AppsLauncherClient() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
      title="OBD Premium Dashboard"
      tagline="Access all your Ocala-focused AI business tools in one place."
    >
      {/* Sections */}
      <div className="space-y-8">
        {APP_SECTIONS.map((section, sectionIndex) => {
          const SectionIcon = section.icon;
          return (
            <section key={sectionIndex} className={`space-y-6 ${sectionIndex === 0 ? "mt-7" : ""}`}>
              {/* Section Header */}
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <SectionIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                    {section.title}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {section.description}
                  </p>
                </div>
              </div>

              {/* Tiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {section.tiles.map((tile, tileIndex) => {
                  const TileIcon = tile.icon;
                  const isComingSoon = tile.comingSoon === true;

                  // Coming Soon Tile
                  if (isComingSoon) {
                    return (
                      <div
                        key={tileIndex}
                        className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col opacity-60"
                      >
                        {/* Icon */}
                        <div className="mb-3">
                          <TileIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          {tile.title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4 flex-grow">
                          {tile.description}
                        </p>

                        {/* Coming Soon Button */}
                        <button
                          disabled
                          className="w-full px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-md cursor-not-allowed"
                        >
                          Coming Soon
                        </button>
                      </div>
                    );
                  }

                  // Live Tile (must have href)
                  if (!tile.href) {
                    return null;
                  }

                  return (
                    <div
                      key={tileIndex}
                      className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col hover:shadow-md transition-shadow"
                    >
                      {/* Icon */}
                      <div className="mb-3">
                        <TileIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                        {tile.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">
                        {tile.description}
                      </p>

                      {/* CTA Button */}
                      <Link
                        href={tile.href}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#29c4a9] hover:bg-[#24b09a] rounded-md transition-colors"
                      >
                        {tile.buttonLabel}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </OBDPageContainer>
  );
}

