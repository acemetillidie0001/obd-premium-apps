"use client";

import { useState, useMemo, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  facebook: { label: "Facebook", icon: "📘" },
  instagram: { label: "Instagram", icon: "📸" },
  "instagram (carousel)": { label: "Instagram (Carousel)", icon: "📸" },
  "google business profile": { label: "Google Business Profile", icon: "📍" },
  x: { label: "X", icon: "✖️" },
};

function getCharacterMeta(count: number, platform: string) {
  const normalized = platform.trim().toLowerCase();
  const isX = normalized === "x";

  if (isX) {
    if (count > 280) return { label: `${count} chars (over X limit)`, tone: "error" };
    if (count > 260) return { label: `${count} chars (near X limit)`, tone: "warning" };
    return { label: `${count} chars`, tone: "default" };
  }

  // generic guidance for other platforms
  if (count < 60) return { label: `${count} chars (short)`, tone: "muted" };
  if (count > 300) return { label: `${count} chars (long)`, tone: "warning" };
  return { label: `${count} chars`, tone: "default" };
}

type SocialTemplate = {
  businessName?: string;
  businessType?: string;
  city?: string;
  state?: string;
  topic?: string;
  details?: string;
  brandVoice?: string;
  personalityStyle?: string;
  postLength?: "Short" | "Medium" | "Long";
  campaignType?:
    | "Everyday Post"
    | "Event"
    | "Limited-Time Offer"
    | "New Service Announcement";
  outputMode?: "Standard" | "InstagramCarousel" | "ContentCalendar";
  numberOfPosts?: number;
  hashtagStyle?: "None" | "Minimal" | "Normal";
  emojiStyle?: "None" | "Minimal" | "Normal";
  tone?: string;
  platform?: "all" | "facebook" | "instagram" | "googleBusinessProfile" | "x";
  carouselSlides?: number;
};

const TEMPLATE_STORAGE_KEY = "obdSocialPostTemplate_v1";

type GeneratedPost = {
  postNumber: number;
  platform: string;
  hook: string;
  bodyLines: string[];
  cta: string;
  raw: string; // full text for this block
  characterCount: number;
};

function parseAiResponse(aiResponse: string): GeneratedPost[] {
  // Split by lines
  const lines = aiResponse.split(/\r?\n/);
  const posts: GeneratedPost[] = [];

  let current: GeneratedPost | null = null;

  function finalizePost(post: GeneratedPost) {
    const text = [
      post.hook,
      ...post.bodyLines,
      post.cta,
    ]
      .join(" ")
      .trim();

    post.characterCount = text.length;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Detect header lines: "Post 1 — Facebook"
    const headerMatch = /^Post\s+(\d+)\s+—\s+(.+)$/.exec(trimmed);
    if (headerMatch) {
      // flush existing
      if (current) {
        finalizePost(current);
        posts.push(current);
      }

      const postNumber = Number(headerMatch[1]);
      const platform = headerMatch[2].trim();

      current = {
        postNumber,
        platform,
        hook: "",
        bodyLines: [],
        cta: "",
        raw: trimmed,
        characterCount: 0,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    // Hook line: "Hook: ..."
    if (trimmed.startsWith("Hook:")) {
      const hook = trimmed.replace(/^Hook:\s*/i, "").trim();
      current.hook = hook;
      current.raw += "\n" + trimmed;
      continue;
    }

    // CTA line: "CTA: ..."
    if (trimmed.startsWith("CTA:")) {
      const cta = trimmed.replace(/^CTA:\s*/i, "").trim();
      current.cta = cta;
      current.raw += "\n" + trimmed;
      continue;
    }

    // Body label line: "Body:" (ignore this line, it's just a label)
    if (trimmed.match(/^Body:\s*$/i)) {
      current.raw += "\n" + trimmed;
      continue;
    }

    // Body line (including "- ..." bullet lines)
    current.bodyLines.push(trimmed);
    current.raw += "\n" + trimmed;
  }

  if (current) {
    finalizePost(current);
    posts.push(current);
  }

  return posts;
}

export default function SocialMediaPostCreatorPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [platform, setPlatform] = useState<"all" | "facebook" | "instagram" | "googleBusinessProfile" | "x">("facebook");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"casual" | "professional" | "engaging">("engaging");
  const [details, setDetails] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [personalityStyle, setPersonalityStyle] = useState<"Soft" | "Bold" | "High-Energy" | "Luxury" | "">("");
  const [postLength, setPostLength] = useState<"Short" | "Medium" | "Long">("Medium");
  const [campaignType, setCampaignType] = useState<"Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement">("Everyday Post");
  const [outputMode, setOutputMode] = useState<"Standard" | "InstagramCarousel" | "ContentCalendar">("Standard");
  const [carouselSlides, setCarouselSlides] = useState<number>(5);
  const [numberOfPosts, setNumberOfPosts] = useState<number>(3);
  const [hashtagStyle, setHashtagStyle] = useState<"None" | "Minimal" | "Normal">("Normal");
  const [emojiStyle, setEmojiStyle] = useState<"None" | "Minimal" | "Normal">("Normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [lastPayload, setLastPayload] = useState<{
    businessName?: string;
    businessType?: string;
    city?: string;
    state?: string;
    platform?: string;
    topic: string;
    tone?: string;
    details?: string;
    brandVoice?: string | null;
    personalityStyle?: "Soft" | "Bold" | "High-Energy" | "Luxury" | "" | null;
    postLength?: "Short" | "Medium" | "Long";
    campaignType?: "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement";
    outputMode?: "Standard" | "InstagramCarousel" | "ContentCalendar";
    carouselSlides?: number;
    numberOfPosts?: number;
    hashtagStyle?: "None" | "Minimal" | "Normal";
    platforms?: {
      facebook?: boolean;
      instagram?: boolean;
      googleBusinessProfile?: boolean;
      x?: boolean;
    };
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const parsedPosts = useMemo(
    () => (aiResponse ? parseAiResponse(aiResponse) : []),
    [aiResponse]
  );

  const [shuffledPosts, setShuffledPosts] = useState<GeneratedPost[] | null>(null);
  const effectivePosts = shuffledPosts ?? parsedPosts;

  useEffect(() => {
    setShuffledPosts(null);
  }, [aiResponse]);

  const applyTemplate = (parsed: SocialTemplate) => {
    if (parsed.businessName) setBusinessName(parsed.businessName);
    if (parsed.businessType) setBusinessType(parsed.businessType);
    if (parsed.topic) setTopic(parsed.topic);
    if (parsed.details) setDetails(parsed.details);
    if (parsed.brandVoice) setBrandVoice(parsed.brandVoice);
    if (parsed.personalityStyle) setPersonalityStyle(parsed.personalityStyle as any);
    if (parsed.postLength) setPostLength(parsed.postLength);
    if (parsed.campaignType) setCampaignType(parsed.campaignType);
    if (parsed.outputMode) setOutputMode(parsed.outputMode);
    if (typeof parsed.numberOfPosts === "number") setNumberOfPosts(parsed.numberOfPosts);
    if (parsed.hashtagStyle) setHashtagStyle(parsed.hashtagStyle);
    if (parsed.emojiStyle) setEmojiStyle(parsed.emojiStyle);
    if (parsed.tone && ["casual", "professional", "engaging"].includes(parsed.tone)) {
      setTone(parsed.tone as "casual" | "professional" | "engaging");
    }
    if (parsed.platform) setPlatform(parsed.platform);
    if (typeof parsed.carouselSlides === "number") setCarouselSlides(parsed.carouselSlides);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as SocialTemplate;
      applyTemplate(parsed);
    } catch {
      // ignore
    }
  }, []);

  const handleSaveTemplate = () => {
    if (typeof window === "undefined") return;
    const template: SocialTemplate = {
      businessName,
      businessType,
      city: "Ocala",
      state: "Florida",
      topic,
      details,
      brandVoice,
      personalityStyle,
      postLength,
      campaignType,
      outputMode,
      numberOfPosts,
      hashtagStyle,
      emojiStyle,
      tone,
      platform,
      carouselSlides,
    };
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    alert("Template saved!");
  };

  const handleLoadTemplate = () => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!stored) {
      alert("No template found.");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SocialTemplate;
      applyTemplate(parsed);
      alert("Template loaded!");
    } catch {
      alert("Error loading template.");
    }
  };

  const handleShufflePosts = () => {
    if (!parsedPosts.length) return;
    if (lastPayload?.outputMode !== "ContentCalendar") return;

    const copy = [...parsedPosts];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setShuffledPosts(copy);
  };

  const processRequest = async (payload: typeof lastPayload) => {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/social-media-post-creator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setAiResponse(data.response || "Error generating post");
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating the post. Please try again."
      );
      setAiResponse("");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topic.trim()) {
      alert("Please enter a topic or message");
      return;
    }

    const isAll = platform === "all";

    const platforms = {
      facebook: isAll || platform === "facebook",
      instagram: isAll || platform === "instagram",
      googleBusinessProfile: isAll || platform === "googleBusinessProfile",
      x: isAll || platform === "x",
    };

    const safeCarouselSlides =
      outputMode === "InstagramCarousel"
        ? Math.min(10, Math.max(3, Number(carouselSlides || 5)))
        : undefined;

    const payload = {
      businessName: businessName || undefined,
      businessType: businessType || undefined,
      city: "Ocala",
      state: "Florida",
      platform,
      topic,
      tone,
      details: details || undefined,
      brandVoice: brandVoice || undefined,
      personalityStyle: personalityStyle || undefined,
      postLength,
      campaignType,
      outputMode,
      carouselSlides: safeCarouselSlides,
      numberOfPosts: Math.min(Math.max(1, numberOfPosts), 10),
      hashtagStyle,
      emojiStyle,
      platforms,
    };

    setLastPayload(payload);
    await processRequest(payload);
  };

  const handleRegenerate = async () => {
    if (!lastPayload) return;
    await processRequest(lastPayload);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadTxt = () => {
    if (!aiResponse) return;

    const blob = new Blob([aiResponse], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "social-posts.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="AI Social Media Post Creator"
      tagline="Generate engaging social media posts for your Ocala business across multiple platforms with just a few details."
    >
      {/* Template buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={handleLoadTemplate}
          className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
            isDark
              ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              : "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Load Template
        </button>
        <button
          type="button"
          onClick={handleSaveTemplate}
          className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
            isDark
              ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              : "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Save Template
        </button>
      </div>

      {/* Form card */}
      <OBDPanel isDark={isDark} className="mt-7">
        <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Name
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala Coffee Shop"
                  />
                </div>

                <div>
                  <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                  />
                </div>

                <div>
                  <label htmlFor="platform" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Platform
                  </label>
                  <select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as "all" | "facebook" | "instagram" | "googleBusinessProfile" | "x")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="all">All Social Profiles</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="googleBusinessProfile">Google Business Profile</option>
                    <option value="x">X</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="topic" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Post Topic / Message
                  </label>
                  <textarea
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={4}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="What would you like to post about? (e.g., new product, event, promotion, etc.)"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="details" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Additional Details (Optional)
                  </label>
                  <textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Any extra context about your business, offer, or message..."
                  />
                </div>

                <div>
                  <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Brand Voice Sample (Optional)
                  </label>
                  <textarea
                    id="brandVoice"
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    rows={3}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste a short example of your brand's writing style. The AI will try to match it."
                  />
                </div>

                <div>
                  <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Personality Style
                  </label>
                  <select
                    id="personalityStyle"
                    value={personalityStyle}
                    onChange={(e) => setPersonalityStyle(e.target.value as "Soft" | "Bold" | "High-Energy" | "Luxury" | "")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="">None selected</option>
                    <option value="Soft">Soft</option>
                    <option value="Bold">Bold</option>
                    <option value="High-Energy">High-Energy</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Used only if no brand voice sample is provided.</p>
                </div>

                <div>
                  <label htmlFor="postLength" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Post Length
                  </label>
                  <select
                    id="postLength"
                    value={postLength}
                    onChange={(e) => setPostLength(e.target.value as "Short" | "Medium" | "Long")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Short">Short</option>
                    <option value="Medium">Medium</option>
                    <option value="Long">Long</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="campaignType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Campaign Type
                  </label>
                  <select
                    id="campaignType"
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value as "Everyday Post" | "Event" | "Limited-Time Offer" | "New Service Announcement")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Everyday Post">Everyday Post</option>
                    <option value="Event">Event</option>
                    <option value="Limited-Time Offer">Limited-Time Offer</option>
                    <option value="New Service Announcement">New Service Announcement</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="outputMode" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Output Mode
                  </label>
                  <select
                    id="outputMode"
                    value={outputMode}
                    onChange={(e) => setOutputMode(e.target.value as "Standard" | "InstagramCarousel" | "ContentCalendar")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Standard">Standard Posts</option>
                    <option value="InstagramCarousel">Instagram Carousel Pack</option>
                    <option value="ContentCalendar">Content Calendar</option>
                  </select>
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Choose how you want your posts structured.</p>
                  {outputMode === "InstagramCarousel" && (
                    <p className={`mt-1 text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                      Instagram Carousel mode focuses on Instagram posts. Other platforms may be ignored.
                    </p>
                  )}
                </div>

                {outputMode === "InstagramCarousel" && (
                  <div>
                    <label htmlFor="carouselSlides" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Slides per Carousel (Instagram)
                    </label>
                    <input
                      type="number"
                      id="carouselSlides"
                      value={carouselSlides}
                      onChange={(e) => setCarouselSlides(Math.min(Math.max(3, parseInt(e.target.value) || 5), 10))}
                      min={3}
                      max={10}
                      className={getInputClasses(isDark)}
                    />
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Generate 3–10 slide captions per Instagram carousel.</p>
                  </div>
                )}

                <div>
                  <label htmlFor="numberOfPosts" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Number of Posts
                  </label>
                  <input
                    type="number"
                    id="numberOfPosts"
                    value={numberOfPosts}
                    onChange={(e) => setNumberOfPosts(Math.min(Math.max(1, parseInt(e.target.value) || 1), 10))}
                    min={1}
                    max={10}
                    className={getInputClasses(isDark)}
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>Generate between 1 and 10 posts at a time.</p>
                </div>

                <div>
                  <label htmlFor="hashtagStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Hashtag Style
                  </label>
                  <select
                    id="hashtagStyle"
                    value={hashtagStyle}
                    onChange={(e) => setHashtagStyle(e.target.value as "None" | "Minimal" | "Normal")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="None">None</option>
                    <option value="Minimal">Minimal</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="emojiStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Emoji Style
                  </label>
                  <select
                    id="emojiStyle"
                    value={emojiStyle}
                    onChange={(e) => setEmojiStyle(e.target.value as "None" | "Minimal" | "Normal")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="None">None</option>
                    <option value="Minimal">Minimal</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="tone" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Tone
                  </label>
                  <select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as "casual" | "professional" | "engaging")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="engaging">Engaging</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  {loading ? "Generating..." : "Create Posts"}
                </button>
              </div>
            </form>
      </OBDPanel>

      {/* Response card */}
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <OBDHeading level={2} isDark={isDark} className="mb-4">
            AI-Generated Posts
          </OBDHeading>
                {(aiResponse || loading || error) && (
                  <div className="flex gap-2">
                    {aiResponse && (
                      <button
                        onClick={handleRegenerate}
                        disabled={loading}
                        className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {loading ? "Regenerating..." : "Regenerate"}
                      </button>
                    )}
                    {aiResponse && (
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    )}
                    {aiResponse && (
                      <button
                        onClick={handleDownloadTxt}
                        disabled={!aiResponse}
                        className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Download .txt
                      </button>
                    )}
                    {effectivePosts.length > 0 && lastPayload?.outputMode === "ContentCalendar" && (
                      <button
                        onClick={handleShufflePosts}
                        disabled={!effectivePosts.length || lastPayload?.outputMode !== "ContentCalendar"}
                        className={`px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Shuffle Posts
                      </button>
                    )}
                  </div>
                )}
              </div>
              {effectivePosts.length > 0 && (
                <div className="mb-6">
                  {lastPayload?.outputMode === "ContentCalendar" && (
                    <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
                      Content Calendar mode: use "Shuffle Posts" to quickly change the day order.
                    </p>
                  )}
                  <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                    Preview by Platform
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {effectivePosts.map((post, idx) => {
                      const normalizedPlatform = post.platform.trim().toLowerCase();
                      const meta = PLATFORM_META[normalizedPlatform] ?? {
                        label: post.platform,
                        icon: "💬",
                      };
                      const isCarousel = normalizedPlatform === "instagram (carousel)" ||
                        (post.bodyLines.length > 0 && /^Slide\s+1\s*[—–-]/i.test(post.bodyLines[0])) ||
                        (post.bodyLines.length > 0 && /^Slide\s+1:/i.test(post.bodyLines[0]));
                      const charMeta = getCharacterMeta(post.characterCount, post.platform);
                      
                      let charClass = `text-xs mt-3 pt-2 border-t ${
                        isDark ? "border-slate-700" : "border-slate-200"
                      }`;
                      if (charMeta.tone === "warning") charClass += isDark ? " text-amber-400" : " text-amber-600";
                      if (charMeta.tone === "error") charClass += isDark ? " text-red-400" : " text-red-600";
                      if (charMeta.tone === "muted") charClass += ` ${themeClasses.mutedText}`;
                      if (charMeta.tone === "default") charClass += isDark ? " text-slate-400" : " text-slate-500";

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4 ${
                            isDark
                              ? "bg-slate-800/50 border-slate-700"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">{meta.icon}</span>
                            <h4 className={`font-semibold ${themeClasses.headingText}`}>
                              Post {post.postNumber} — {meta.label}
                            </h4>
                          </div>
                          {post.hook && (
                            <p className={`font-medium mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                              {post.hook}
                            </p>
                          )}
                          {post.bodyLines.length > 0 && (
                            <>
                              {isCarousel ? (
                                <div className="mt-3 mb-2">
                                  <h5 className={`text-xs font-semibold mb-3 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                    Instagram Carousel Slides
                                  </h5>
                                  {/* Slide number indicators */}
                                  <div className={`flex items-center gap-1.5 mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                    {post.bodyLines.map((_, slideIdx) => {
                                      const match = /^Slide\s+(\d+)/i.exec(post.bodyLines[slideIdx]);
                                      const slideNum = match ? match[1] : `${slideIdx + 1}`;
                                      return (
                                        <span key={slideIdx} className="text-xs">
                                          {slideNum}
                                          {slideIdx < post.bodyLines.length - 1 && " •"}
                                        </span>
                                      );
                                    })}
                                  </div>
                                  {/* Slide cards */}
                                  <div className={`space-y-3 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                    {post.bodyLines.map((line, lineIdx) => {
                                      const match = /^Slide\s+(\d+)\s*[—–-]\s*(.*)$/i.exec(line.trim()) ||
                                                    /^Slide\s+(\d+):\s*(.*)$/i.exec(line.trim());
                                      let slideNumber = match ? match[1] : `${lineIdx + 1}`;
                                      let slideText = match ? match[2].trim() : line.trim();
                                      
                                      // Clean any leftover prefixes
                                      slideText = slideText.replace(/^[-—–:]\s*/, '').trim();

                                      return (
                                        <div key={lineIdx} className={`border rounded-lg p-3 shadow-sm ${
                                          isDark
                                            ? "bg-slate-700/40 border-slate-600 shadow-slate-900/20"
                                            : "bg-slate-100/60 border-slate-300 shadow-slate-200/50"
                                        }`}>
                                          <div className={`text-xs font-semibold mb-1.5 ${
                                            isDark ? "text-slate-300" : "text-gray-600"
                                          }`}>
                                            Slide {slideNumber}
                                          </div>
                                          <div className={`text-sm leading-snug ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                                            {slideText}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {/* Divider before CTA */}
                                  <div className={`border-t my-4 ${isDark ? "border-slate-700" : "border-slate-200"}`} />
                                </div>
                              ) : (
                                <div className={`mb-2 space-y-1 ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                                  {post.bodyLines.map((line, lineIdx) => (
                                    <p key={lineIdx} className={line.startsWith("- ") ? "" : "pl-4"}>
                                      {line.startsWith("- ") ? line : `• ${line}`}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          {post.cta && (
                            <p className={`mt-2 italic text-sm ${themeClasses.mutedText}`}>
                              CTA: {post.cta}
                            </p>
                          )}
                          <p className={charClass}>
                            {charMeta.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
        <div className={`min-h-[200px] p-4 border ${themeClasses.inputBorder} rounded-xl ${
          isDark ? "bg-slate-800" : "bg-gray-50"
        }`}>
          {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className={themeClasses.mutedText}>Generating post...</div>
          </div>
        ) : error ? (
          <div className={getErrorPanelClasses(isDark)}>
            <p className="font-medium mb-2">Error:</p>
            <p>{error}</p>
          </div>
          ) : aiResponse ? (
            <p className={`whitespace-pre-wrap ${isDark ? "text-slate-100" : "text-gray-800"}`}>
              {aiResponse}
            </p>
          ) : (
            <p className={`italic obd-soft-text ${isDark ? "text-slate-500" : "text-gray-400"}`}>
              Your AI-generated social media posts will appear here...
            </p>
          )}
        </div>
      </OBDPanel>
    </OBDPageContainer>
  );
}

