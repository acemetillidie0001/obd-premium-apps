import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { hasDemoCookie } from "@/lib/demo/demo-cookie";

interface AppTile {
  title: string;
  description: string;
  href?: string; // Optional - not required for comingSoon tiles
  icon?: string;
  comingSoon?: boolean;
}

interface AppSection {
  title: string;
  description: string;
  tiles: AppTile[];
}

const APP_SECTIONS: AppSection[] = [
  {
    title: "My Account",
    description: "Manage your account settings and preferences",
    tiles: [
      {
        title: "Account Settings",
        description: "View and update your account information",
        icon: "⚙️",
        comingSoon: true,
      },
    ],
  },
  {
    title: "Content & Writing Tools",
    description: "Create compelling content for your business",
    tiles: [
      {
        title: "Content Writer",
        description: "Generate blog posts, service pages, and more",
        href: "/apps/content-writer",
        icon: "✍️",
      },
      {
        title: "Business Description Writer",
        description: "Craft professional business descriptions",
        href: "/apps/business-description-writer",
        icon: "📝",
      },
      {
        title: "FAQ Generator",
        description: "Create comprehensive FAQ sections",
        href: "/apps/faq-generator",
        icon: "❓",
      },
      {
        title: "Event Campaign Builder",
        description: "Build engaging event marketing campaigns",
        href: "/apps/event-campaign-builder",
        icon: "📅",
      },
      {
        title: "Offers Builder",
        description: "Create compelling promotional offers",
        href: "/apps/offers-builder",
        icon: "🎁",
      },
    ],
  },
  {
    title: "Reputation & Reviews",
    description: "Manage and improve your online reputation",
    tiles: [
      {
        title: "Review Responder",
        description: "Generate professional review responses",
        href: "/apps/review-responder",
        icon: "💬",
      },
      {
        title: "Reputation Dashboard",
        description: "Monitor and analyze your online reviews",
        href: "/apps/reputation-dashboard",
        icon: "📊",
      },
      {
        title: "Review Request Automation",
        description: "Automatically request reviews from customers",
        href: "/apps/review-request-automation",
        icon: "🤖",
      },
    ],
  },
  {
    title: "Google Business & Local Search",
    description: "Optimize your Google Business Profile and local presence",
    tiles: [
      {
        title: "Google Business Pro",
        description: "Advanced Google Business Profile management",
        href: "/apps/google-business-pro",
        icon: "📍",
      },
      {
        title: "Local Keyword Research",
        description: "Discover high-value local keywords",
        href: "/apps/local-keyword-research",
        icon: "🔍",
      },
      {
        title: "Local SEO Page Builder",
        description: "Create optimized local landing pages",
        href: "/apps/local-seo-page-builder",
        icon: "🏠",
      },
      {
        title: "Local Hiring Assistant",
        description: "Generate job postings and hiring content",
        href: "/apps/local-hiring-assistant",
        icon: "👥",
      },
    ],
  },
  {
    title: "SEO Tools",
    description: "Improve your search engine visibility",
    tiles: [
      {
        title: "SEO Audit Roadmap",
        description: "Get a comprehensive SEO improvement plan",
        href: "/apps/seo-audit-roadmap",
        icon: "🗺️",
      },
      {
        title: "Business Schema Generator",
        description: "Generate structured data for your business",
        href: "/apps/business-schema-generator",
        icon: "📋",
      },
    ],
  },
  {
    title: "Productivity & Automation",
    description: "Streamline your business operations",
    tiles: [
      {
        title: "Social Auto Poster",
        description: "Automate social media posting",
        href: "/apps/social-auto-poster",
        icon: "📱",
      },
      {
        title: "OBD CRM",
        description: "Manage customer relationships and contacts",
        href: "/apps/obd-crm",
        icon: "👤",
      },
      {
        title: "OBD Scheduler",
        description: "Schedule appointments and manage bookings",
        href: "/apps/obd-scheduler",
        icon: "📆",
      },
      {
        title: "AI Help Desk",
        description: "Intelligent customer support automation",
        href: "/apps/ai-help-desk",
        icon: "🤖",
      },
    ],
  },
  {
    title: "Design & Branding",
    description: "Create stunning visuals and build your brand",
    tiles: [
      {
        title: "AI Logo Generator",
        description: "Generate custom logos with AI",
        href: "/apps/ai-logo-generator",
        icon: "🎨",
      },
      {
        title: "Brand Kit Builder",
        description: "Create comprehensive brand guidelines",
        href: "/apps/brand-kit-builder",
        icon: "🎯",
      },
      {
        title: "Brand Profile",
        description: "Define and manage your brand identity",
        href: "/apps/brand-profile",
        icon: "🆔",
      },
      {
        title: "Image Generator",
        description: "Create custom images with AI",
        href: "/apps/image-generator",
        icon: "🖼️",
      },
      {
        title: "Image Caption Generator",
        description: "Generate engaging captions for images",
        href: "/apps/image-caption-generator",
        icon: "📸",
      },
      {
        title: "Social Media Post Creator",
        description: "Create eye-catching social media posts",
        href: "/apps/social-media-post-creator",
        icon: "📲",
      },
    ],
  },
];

export default async function AppsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/apps");
  }

  // Check if demo mode is active (for conditional rendering if needed)
  const cookieStore = await cookies();
  const isDemo = hasDemoCookie(cookieStore);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Premium Apps Dashboard
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Access all your Ocala-focused AI tools in one place
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {APP_SECTIONS.map((section, sectionIndex) => (
            <section key={sectionIndex} className="space-y-4">
              {/* Section Header */}
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                  {section.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {section.description}
                </p>
              </div>

              {/* Tiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {section.tiles.map((tile, tileIndex) => {
                  const isComingSoon = tile.comingSoon === true;

                  // Coming Soon Tile
                  if (isComingSoon) {
                    return (
                      <div
                        key={tileIndex}
                        className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 opacity-70 cursor-not-allowed"
                      >
                        {/* Icon */}
                        {tile.icon && (
                          <div className="text-3xl mb-3 opacity-60">
                            {tile.icon}
                          </div>
                        )}

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          {tile.title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-slate-500 dark:text-slate-500 line-clamp-2 mb-4">
                          {tile.description}
                        </p>

                        {/* Coming Soon Button */}
                        <button
                          disabled
                          className="w-full mt-auto px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-not-allowed"
                        >
                          Coming Soon
                        </button>
                      </div>
                    );
                  }

                  // Live Tile (must have href)
                  if (!tile.href) {
                    // Fallback: if somehow a live tile has no href, skip it
                    return null;
                  }

                  return (
                    <Link
                      key={tileIndex}
                      href={tile.href}
                      className="group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-lg border border-slate-200 dark:border-slate-700 p-6 transition-all duration-200 hover:scale-[1.02] hover:border-[#29c4a9]/50"
                    >
                      {/* Icon */}
                      {tile.icon && (
                        <div className="text-3xl mb-3">{tile.icon}</div>
                      )}

                      {/* Title */}
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-[#29c4a9] transition-colors">
                        {tile.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                        {tile.description}
                      </p>

                      {/* Hover Indicator */}
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg
                          className="w-5 h-5 text-[#29c4a9]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
