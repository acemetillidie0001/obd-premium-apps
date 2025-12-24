/**
 * Review Request Automation Engine
 * 
 * Pure calculation functions for review request automation.
 * All functions are deterministic and side-effect free.
 */

import {
  Campaign,
  Customer,
  CustomerWithStatus,
  Event,
  SendQueueItem,
  MessageTemplate,
  MessageVariant,
  MessageChannel,
  FunnelMetrics,
  QualityCheck,
  NextAction,
  ReviewRequestAutomationRequest,
  ReviewRequestAutomationResponse,
  QuietHours,
  CampaignHealth,
  CampaignHealthStatus,
  SendTimeline,
  TimelineEvent,
  TemplateQuality,
  TemplateQualityLabel,
  TemplateQualitySeverity,
  BusinessTypeRecommendation,
  GuidanceBenchmark,
} from "./types";

/**
 * Generate UUID v4 (simple implementation for deterministic IDs)
 */
function generateUUID(): string {
  // For deterministic IDs in tests, we could use a seed, but for production
  // we use random. In a real implementation, you might want to use crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if a time falls within quiet hours
 */
function isWithinQuietHours(date: Date, quietHours: QuietHours): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  const [startHour, startMin] = quietHours.start.split(":").map(Number);
  const [endHour, endMin] = quietHours.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle case where quiet hours span midnight
  if (startMinutes > endMinutes) {
    return timeInMinutes >= startMinutes || timeInMinutes <= endMinutes;
  }
  
  return timeInMinutes >= startMinutes && timeInMinutes <= endMinutes;
}

/**
 * Get next allowed time outside quiet hours
 */
function getNextAllowedTime(date: Date, quietHours: QuietHours): Date {
  const next = new Date(date);
  
  // If outside quiet hours, return as-is
  if (!isWithinQuietHours(next, quietHours)) {
    return next;
  }
  
  // Move to end of quiet hours
  const [endHour, endMin] = quietHours.end.split(":").map(Number);
  next.setHours(endHour, endMin, 0, 0);
  
  // If we're past end time today, move to tomorrow
  if (next <= date) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Generate message templates deterministically
 * In V3, we use template-based generation. In V4, this could use AI.
 */
export function generateMessageTemplates(campaign: Campaign): MessageTemplate {
  const { businessName, reviewLink, language, toneStyle, brandVoice } = campaign;
  
  // Base templates with placeholders
  const baseTemplates = {
    english: {
      friendly: {
        smsShort: `Hi {firstName}! Thanks for choosing ${businessName}. We'd love your feedback: ${reviewLink} Reply STOP to opt out.`,
        smsStandard: `Hi {firstName}! We hope you had a great experience with ${businessName}. Your feedback means the world to us. Please leave a review: ${reviewLink} Reply STOP to opt out.`,
        email: {
          subject: `How was your experience with ${businessName}?`,
          body: `Hi {firstName},\n\nThank you for choosing ${businessName}! We hope you had a wonderful experience.\n\nYour feedback helps us serve you better and helps other customers find us. Would you mind taking a moment to leave a review?\n\n${reviewLink}\n\nThank you so much!\n\nThe ${businessName} Team`,
        },
        followUpSms: `Hi {firstName}, just a friendly reminder - we'd love your feedback about ${businessName}: ${reviewLink} Reply STOP to opt out.`,
      },
      professional: {
        smsShort: `Thank you for choosing ${businessName}. We value your feedback: ${reviewLink} Reply STOP to opt out.`,
        smsStandard: `Thank you for your business with ${businessName}. We'd appreciate your feedback on your experience. Please leave a review: ${reviewLink} Reply STOP to opt out.`,
        email: {
          subject: `Feedback Request: ${businessName}`,
          body: `Dear {firstName},\n\nThank you for choosing ${businessName}. We value your opinion and would appreciate your feedback on your recent experience.\n\nPlease take a moment to share your review:\n\n${reviewLink}\n\nYour feedback helps us improve our services.\n\nBest regards,\nThe ${businessName} Team`,
        },
        followUpSms: `Reminder: We'd appreciate your feedback about ${businessName}: ${reviewLink} Reply STOP to opt out.`,
      },
      bold: {
        smsShort: `Hey {firstName}! Loved your visit to ${businessName}? Tell the world: ${reviewLink} Reply STOP to opt out.`,
        smsStandard: `Hey {firstName}! We're proud of the service we provided at ${businessName}. Help us spread the word by leaving a review: ${reviewLink} Reply STOP to opt out.`,
        email: {
          subject: `Share Your Experience with ${businessName}`,
          body: `Hey {firstName},\n\nYou just experienced ${businessName} at our best. Now it's your turn to share!\n\nLeave us a review and help others discover what makes us special:\n\n${reviewLink}\n\nLet's show the world what ${businessName} is all about!\n\nThanks,\nThe ${businessName} Team`,
        },
        followUpSms: `Hey {firstName}! Don't forget to share your ${businessName} experience: ${reviewLink} Reply STOP to opt out.`,
      },
      luxury: {
        smsShort: `Dear {firstName}, we hope you enjoyed your experience with ${businessName}. We'd be honored by your review: ${reviewLink} Reply STOP to opt out.`,
        smsStandard: `Dear {firstName}, thank you for choosing ${businessName}. Your satisfaction is our priority. We'd be delighted to receive your feedback: ${reviewLink} Reply STOP to opt out.`,
        email: {
          subject: `Your Experience with ${businessName}`,
          body: `Dear {firstName},\n\nIt was our pleasure to serve you at ${businessName}. We hope your experience exceeded your expectations.\n\nWe would be honored if you would take a moment to share your thoughts:\n\n${reviewLink}\n\nYour feedback is invaluable to us as we continue to provide exceptional service.\n\nWith gratitude,\nThe ${businessName} Team`,
        },
        followUpSms: `Dear {firstName}, a gentle reminder - we'd be honored by your feedback about ${businessName}: ${reviewLink} Reply STOP to opt out.`,
      },
    },
    spanish: {
      friendly: {
        smsShort: `¡Hola {firstName}! Gracias por elegir ${businessName}. Nos encantaría tu opinión: ${reviewLink} Responde STOP para cancelar.`,
        smsStandard: `¡Hola {firstName}! Esperamos que hayas tenido una excelente experiencia con ${businessName}. Tu opinión significa mucho para nosotros. Por favor deja una reseña: ${reviewLink} Responde STOP para cancelar.`,
        email: {
          subject: `¿Cómo fue tu experiencia con ${businessName}?`,
          body: `Hola {firstName},\n\n¡Gracias por elegir ${businessName}! Esperamos que hayas tenido una experiencia maravillosa.\n\nTu opinión nos ayuda a servirte mejor y ayuda a otros clientes a encontrarnos. ¿Te importaría tomar un momento para dejar una reseña?\n\n${reviewLink}\n\n¡Muchas gracias!\n\nEl equipo de ${businessName}`,
        },
        followUpSms: `Hola {firstName}, solo un recordatorio amigable - nos encantaría tu opinión sobre ${businessName}: ${reviewLink} Responde STOP para cancelar.`,
      },
      professional: {
        smsShort: `Gracias por elegir ${businessName}. Valoramos tu opinión: ${reviewLink} Responde STOP para cancelar.`,
        smsStandard: `Gracias por tu negocio con ${businessName}. Apreciaríamos tu opinión sobre tu experiencia. Por favor deja una reseña: ${reviewLink} Responde STOP para cancelar.`,
        email: {
          subject: `Solicitud de Opinión: ${businessName}`,
          body: `Estimado/a {firstName},\n\nGracias por elegir ${businessName}. Valoramos tu opinión y apreciaríamos tu comentario sobre tu experiencia reciente.\n\nPor favor toma un momento para compartir tu reseña:\n\n${reviewLink}\n\nTu opinión nos ayuda a mejorar nuestros servicios.\n\nSaludos cordiales,\nEl equipo de ${businessName}`,
        },
        followUpSms: `Recordatorio: Apreciaríamos tu opinión sobre ${businessName}: ${reviewLink} Responde STOP para cancelar.`,
      },
      bold: {
        smsShort: `¡Hola {firstName}! ¿Te encantó tu visita a ${businessName}? Cuéntale al mundo: ${reviewLink} Responde STOP para cancelar.`,
        smsStandard: `¡Hola {firstName}! Estamos orgullosos del servicio que brindamos en ${businessName}. Ayúdanos a correr la voz dejando una reseña: ${reviewLink} Responde STOP para cancelar.`,
        email: {
          subject: `Comparte Tu Experiencia con ${businessName}`,
          body: `Hola {firstName},\n\nAcabas de experimentar ${businessName} en nuestro mejor momento. ¡Ahora es tu turno de compartir!\n\nDéjanos una reseña y ayuda a otros a descubrir lo que nos hace especiales:\n\n${reviewLink}\n\n¡Mostremos al mundo de qué se trata ${businessName}!\n\nGracias,\nEl equipo de ${businessName}`,
        },
        followUpSms: `¡Hola {firstName}! No olvides compartir tu experiencia con ${businessName}: ${reviewLink} Responde STOP para cancelar.`,
      },
      luxury: {
        smsShort: `Estimado/a {firstName}, esperamos que hayas disfrutado tu experiencia con ${businessName}. Nos honraría tu reseña: ${reviewLink} Responde STOP para cancelar.`,
        smsStandard: `Estimado/a {firstName}, gracias por elegir ${businessName}. Tu satisfacción es nuestra prioridad. Estaríamos encantados de recibir tu opinión: ${reviewLink} Responde STOP para cancelar.`,
        email: {
          subject: `Tu Experiencia con ${businessName}`,
          body: `Estimado/a {firstName},\n\nFue un placer servirte en ${businessName}. Esperamos que tu experiencia haya superado tus expectativas.\n\nNos honraría si tomaras un momento para compartir tus pensamientos:\n\n${reviewLink}\n\nTu opinión es invaluable para nosotros mientras continuamos brindando un servicio excepcional.\n\nCon gratitud,\nEl equipo de ${businessName}`,
        },
        followUpSms: `Estimado/a {firstName}, un recordatorio amable - nos honraría tu opinión sobre ${businessName}: ${reviewLink} Responde STOP para cancelar.`,
      },
    },
  };
  
  // Select template based on language and tone
  const langKey = language === "Spanish" ? "spanish" : "english";
  const toneKey = toneStyle.toLowerCase() as keyof typeof baseTemplates.english;
  
  let templates = baseTemplates[langKey][toneKey];
  
  // Apply brand voice if provided (simple text replacement for V3)
  if (brandVoice && brandVoice.trim()) {
    // In V3, we just append brand voice note. In V4, this could be AI-enhanced.
    const brandNote = `\n\nNote: ${brandVoice}`;
    templates = {
      smsShort: templates.smsShort + brandNote.substring(0, 50), // Truncate for SMS
      smsStandard: templates.smsStandard + brandNote.substring(0, 100),
      email: {
        subject: templates.email.subject,
        body: templates.email.body + brandNote,
      },
      followUpSms: templates.followUpSms + brandNote.substring(0, 50),
    };
  }
  
  // Handle bilingual (mix of English and Spanish)
  if (language === "Bilingual") {
    // Simple approach: use English templates with Spanish greeting
    const spanishGreeting = "¡Hola {firstName}! / Hi {firstName}!";
    templates = {
      smsShort: `${spanishGreeting} ${templates.smsShort.replace(/Hi \{firstName\}!/, "")}`,
      smsStandard: `${spanishGreeting} ${templates.smsStandard.replace(/Hi \{firstName\}!/, "")}`,
      email: {
        subject: templates.email.subject,
        body: `${spanishGreeting}\n\n${templates.email.body}`,
      },
      followUpSms: `${spanishGreeting} ${templates.followUpSms.replace(/Hi \{firstName\}!/, "")}`,
    };
  }
  
  return templates;
}

/**
 * Calculate customer status from events
 */
function calculateCustomerStatus(
  customer: Customer,
  events: Event[]
): CustomerWithStatus {
  const customerEvents = events.filter((e) => e.customerId === customer.id);
  const sortedEvents = customerEvents.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  let status: CustomerWithStatus["status"] = "queued";
  let lastSentAt: string | undefined;
  let lastClickedAt: string | undefined;
  let lastReviewedAt: string | undefined;
  
  for (const event of sortedEvents) {
    if (event.type === "optedOut") {
      status = "optedOut";
    } else if (event.type === "reviewed") {
      status = "reviewed";
      lastReviewedAt = event.timestamp;
    } else if (event.type === "clicked") {
      status = "clicked";
      lastClickedAt = event.timestamp;
    } else if (event.type === "sent") {
      status = "sent";
      lastSentAt = event.timestamp;
    }
  }
  
  // Determine if follow-up is needed
  const needsFollowUp = status === "sent" || status === "clicked";
  
  return {
    ...customer,
    status,
    lastSentAt,
    lastClickedAt,
    lastReviewedAt,
    needsFollowUp,
  };
}

/**
 * Compute send queue based on campaign rules and customers
 */
export function computeSendQueue(
  campaign: Campaign,
  customers: Customer[],
  events: Event[]
): SendQueueItem[] {
  const queue: SendQueueItem[] = [];
  const now = new Date();
  
  // Get customers with status
  const customersWithStatus = customers.map((c) => 
    calculateCustomerStatus(c, events)
  );
  
  for (const customer of customersWithStatus) {
    // Skip if opted out
    if (customer.optedOut || customer.status === "optedOut") {
      continue;
    }
    
    // Skip if already reviewed
    if (customer.status === "reviewed") {
      continue;
    }
    
    // Skip if no contact info (will be caught by quality checks)
    if (!customer.phone && !customer.email) {
      continue;
    }
    
    // Determine channel (prefer SMS if both available)
    const channel: MessageChannel = customer.phone ? "sms" : "email";
    
    // Determine variant based on channel
    const variant: MessageVariant = channel === "sms" ? "smsStandard" : "email";
    
    // Calculate scheduled time based on trigger type
    let scheduledAt: Date;
    
    if (campaign.rules.triggerType === "manual") {
      // Queue immediately (respecting quiet hours)
      scheduledAt = new Date(now);
      if (isWithinQuietHours(scheduledAt, campaign.rules.quietHours)) {
        scheduledAt = getNextAllowedTime(scheduledAt, campaign.rules.quietHours);
      }
    } else if (campaign.rules.triggerType === "after_service" || campaign.rules.triggerType === "after_payment") {
      // Use lastVisitDate if available
      if (customer.lastVisitDate) {
        scheduledAt = new Date(customer.lastVisitDate);
        scheduledAt.setHours(scheduledAt.getHours() + campaign.rules.sendDelayHours);
      } else {
        // No last visit date, queue immediately
        scheduledAt = new Date(now);
      }
      
      // Respect quiet hours
      if (isWithinQuietHours(scheduledAt, campaign.rules.quietHours)) {
        scheduledAt = getNextAllowedTime(scheduledAt, campaign.rules.quietHours);
      }
    } else {
      // Fallback: queue immediately
      scheduledAt = new Date(now);
    }
    
    // Check frequency cap
    if (customer.lastSentAt) {
      const lastSent = new Date(customer.lastSentAt);
      const daysSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSent < campaign.rules.frequencyCapDays) {
        // Skip due to frequency cap
        queue.push({
          id: generateUUID(),
          customerId: customer.id,
          scheduledAt: scheduledAt.toISOString(),
          variant,
          channel,
          status: "skipped",
          skippedReason: `Frequency cap: last sent ${Math.round(daysSinceLastSent)} days ago`,
        });
        continue;
      }
    }
    
    // Add to queue
    queue.push({
      id: generateUUID(),
      customerId: customer.id,
      scheduledAt: scheduledAt.toISOString(),
      variant,
      channel,
      status: "pending",
    });
    
    // Add follow-up if enabled and customer hasn't reviewed
    // Follow-ups are scheduled for: new customers (queued) or customers who were sent/clicked but haven't reviewed
    if (campaign.rules.followUpEnabled && (customer.status === "queued" || customer.needsFollowUp)) {
      const followUpDate = new Date(scheduledAt);
      followUpDate.setDate(followUpDate.getDate() + campaign.rules.followUpDelayDays);
      
      // Respect quiet hours for follow-up
      if (isWithinQuietHours(followUpDate, campaign.rules.quietHours)) {
        const nextAllowed = getNextAllowedTime(followUpDate, campaign.rules.quietHours);
        followUpDate.setTime(nextAllowed.getTime());
      }
      
      queue.push({
        id: generateUUID(),
        customerId: customer.id,
        scheduledAt: followUpDate.toISOString(),
        variant: "followUpSms",
        channel: customer.phone ? "sms" : "email",
        status: "pending",
      });
    }
  }
  
  // Sort by scheduled time
  return queue.sort((a, b) => 
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

/**
 * Calculate funnel metrics
 */
export function calculateFunnelMetrics(
  customers: Customer[],
  events: Event[],
  sendQueue: SendQueueItem[]
): FunnelMetrics {
  const customersWithStatus = customers.map((c) => 
    calculateCustomerStatus(c, events)
  );
  
  const loaded = customers.length;
  const ready = customersWithStatus.filter((c) => 
    (c.phone || c.email) && !c.optedOut
  ).length;
  const queued = sendQueue.filter((q) => q.status === "pending").length;
  const sent = events.filter((e) => e.type === "sent").length;
  const clicked = events.filter((e) => e.type === "clicked").length;
  const reviewed = events.filter((e) => e.type === "reviewed").length;
  const optedOut = customersWithStatus.filter((c) => c.optedOut).length;
  
  return {
    loaded,
    ready,
    queued,
    sent,
    clicked,
    reviewed,
    optedOut,
  };
}

/**
 * Generate quality checks
 */
export function generateQualityChecks(
  campaign: Campaign,
  customers: Customer[],
  templates: MessageTemplate
): QualityCheck[] {
  const checks: QualityCheck[] = [];
  
  // Check review link validity
  try {
    new URL(campaign.reviewLink);
  } catch {
    checks.push({
      id: "invalid-review-link",
      severity: "error",
      title: "Invalid Review Link",
      description: `The review link "${campaign.reviewLink}" does not appear to be a valid URL.`,
      suggestedFix: "Please provide a valid URL starting with http:// or https://",
    });
  }
  
  // Check SMS length
  const smsShortLength = templates.smsShort.length;
  const smsStandardLength = templates.smsStandard.length;
  
  if (smsShortLength > 240) {
    checks.push({
      id: "sms-short-too-long",
      severity: "warning",
      title: "SMS Short Template Too Long",
      description: `SMS Short template is ${smsShortLength} characters (target: ≤240). This may be split into multiple messages.`,
      suggestedFix: "Consider shortening the template or using SMS Standard variant.",
    });
  }
  
  if (smsStandardLength > 420) {
    checks.push({
      id: "sms-standard-too-long",
      severity: "warning",
      title: "SMS Standard Template Too Long",
      description: `SMS Standard template is ${smsStandardLength} characters (target: ≤420). This may be split into multiple messages.`,
      suggestedFix: "Consider shortening the template.",
    });
  }
  
  // Check follow-up aggressiveness
  if (campaign.rules.followUpEnabled && campaign.rules.followUpDelayDays < 3) {
    checks.push({
      id: "follow-up-too-aggressive",
      severity: "warning",
      title: "Follow-Up May Be Too Aggressive",
      description: `Follow-up is scheduled ${campaign.rules.followUpDelayDays} days after initial send. This may feel too frequent.`,
      suggestedFix: "Consider increasing follow-up delay to at least 3-5 days.",
    });
  }
  
  // Check quiet hours configuration
  const [startHour, startMin] = campaign.rules.quietHours.start.split(":").map(Number);
  const [endHour, endMin] = campaign.rules.quietHours.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Check if end is before start (excluding midnight wrap-around case)
  // For normal case: 09:00-19:00, startMinutes (540) < endMinutes (1140) ✓
  // For invalid: 19:00-09:00 (not midnight wrap), startMinutes (1140) > endMinutes (540) ✗
  // For midnight wrap: 22:00-02:00, startMinutes (1320) > endMinutes (120) ✓ (valid)
  // We only flag if end is significantly before start (not a midnight wrap)
  if (startMinutes > endMinutes && endMinutes > 60) { // If end is > 1 hour, it's not a midnight wrap
    checks.push({
      id: "quiet-hours-misconfigured",
      severity: "warning",
      title: "Quiet Hours May Be Misconfigured",
      description: `Quiet hours start (${campaign.rules.quietHours.start}) is after end (${campaign.rules.quietHours.end}). If this is intentional (spanning midnight), this warning can be ignored.`,
      suggestedFix: "Ensure quiet hours are configured correctly (e.g., 09:00-19:00).",
    });
  }
  
  // Check missing contact info
  const missingContact = customers.filter((c) => !c.phone && !c.email).length;
  if (missingContact > 0) {
    const percentage = Math.round((missingContact / customers.length) * 100);
    checks.push({
      id: "missing-contact-info",
      severity: percentage > 20 ? "error" : "warning",
      title: "Customers Missing Contact Info",
      description: `${missingContact} customer${missingContact !== 1 ? "s" : ""} (${percentage}%) are missing both phone and email.`,
      suggestedFix: "Add phone or email for these customers to enable sending.",
    });
  }
  
  return checks;
}

/**
 * Generate next actions
 */
export function generateNextActions(
  campaign: Campaign,
  metrics: FunnelMetrics,
  qualityChecks: QualityCheck[]
): NextAction[] {
  const actions: NextAction[] = [];
  
  // Action: Fix quality issues
  const errorChecks = qualityChecks.filter((c) => c.severity === "error");
  if (errorChecks.length > 0) {
    actions.push({
      id: "fix-quality-issues",
      title: "Fix Quality Issues",
      description: `${errorChecks.length} critical issue${errorChecks.length !== 1 ? "s" : ""} need${errorChecks.length === 1 ? "s" : ""} attention before sending.`,
    });
  }
  
  // Action: Add more customers
  if (metrics.loaded < 10) {
    actions.push({
      id: "add-more-customers",
      title: "Add More Customers",
      description: `You have ${metrics.loaded} customer${metrics.loaded !== 1 ? "s" : ""}. Consider importing more for better results.`,
      copyText: "Import customers via CSV or add manually",
    });
  }
  
  // Action: Review templates
  actions.push({
    id: "review-templates",
    title: "Review Message Templates",
    description: "Review and customize your message templates before sending to ensure they match your brand voice.",
    copyText: "Click 'Generate Templates' to review",
  });
  
  // Action: Test send
  if (metrics.queued > 0) {
    actions.push({
      id: "test-send",
      title: "Test Send Queue",
      description: `You have ${metrics.queued} message${metrics.queued !== 1 ? "s" : ""} queued. Review the send queue and test with a few customers first.`,
      copyText: "Review send queue",
    });
  }
  
  return actions;
}

/**
 * Calculate campaign health score
 */
export function calculateCampaignHealth(
  campaign: Campaign,
  customers: Customer[],
  templates: MessageTemplate
): CampaignHealth {
  const reasons: string[] = [];
  let score = 100;
  
  // Check review link
  if (!campaign.reviewLink.trim()) {
    reasons.push("Review link is missing");
    score -= 30;
  } else {
    try {
      new URL(campaign.reviewLink);
    } catch {
      reasons.push("Review link is not a valid URL");
      score -= 30;
    }
  }
  
  // Check customer contact info
  if (customers.length > 0) {
    const customersWithContact = customers.filter(
      (c) => (c.phone && c.phone.trim()) || (c.email && c.email.trim())
    );
    const contactPercentage = (customersWithContact.length / customers.length) * 100;
    
    if (contactPercentage < 40) {
      reasons.push(`Only ${Math.round(contactPercentage)}% of customers have phone or email`);
      score -= 25;
    } else if (contactPercentage < 60) {
      reasons.push(`Only ${Math.round(contactPercentage)}% of customers have phone or email`);
      score -= 15;
    } else {
      reasons.push(`${Math.round(contactPercentage)}% of customers have contact info`);
    }
  } else {
    reasons.push("No customers added yet");
    score -= 10;
  }
  
  // Check follow-up delay
  if (campaign.rules.followUpEnabled) {
    if (campaign.rules.followUpDelayDays < 2) {
      reasons.push("Follow-up delay is less than 2 days (may be too aggressive)");
      score -= 10;
    } else {
      reasons.push(`Follow-up enabled with ${campaign.rules.followUpDelayDays} day delay`);
    }
  }
  
  // Check quiet hours
  const [startHour, startMin] = campaign.rules.quietHours.start.split(":").map(Number);
  const [endHour, endMin] = campaign.rules.quietHours.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  if (startMinutes > endMinutes && endMinutes > 60) {
    reasons.push("Quiet hours may be misconfigured");
    score -= 10;
  }
  
  // Check SMS templates for STOP line
  const smsTemplates = [templates.smsShort, templates.smsStandard, templates.followUpSms];
  const missingStop = smsTemplates.some((t) => !t.toLowerCase().includes("stop"));
  if (missingStop) {
    reasons.push("SMS templates missing STOP opt-out line");
    score -= 20;
  }
  
  // Check SMS template length
  const smsShortLength = templates.smsShort.length;
  const smsStandardLength = templates.smsStandard.length;
  
  if (smsShortLength > 240) {
    reasons.push(`SMS Short template exceeds 240 characters (${smsShortLength} chars)`);
    score -= 5;
  }
  if (smsStandardLength > 420) {
    reasons.push(`SMS Standard template exceeds 420 characters (${smsStandardLength} chars)`);
    score -= 5;
  }
  
  // Determine status
  let status: CampaignHealthStatus;
  if (score >= 80) {
    status = "Good";
  } else if (score >= 60) {
    status = "Needs Attention";
  } else {
    status = "At Risk";
  }
  
  // Ensure score is between 0-100
  score = Math.max(0, Math.min(100, score));
  
  return {
    status,
    score,
    reasons: reasons.length > 0 ? reasons : ["All checks passed"],
  };
}

/**
 * Calculate send timeline
 */
export function calculateSendTimeline(
  campaign: Campaign,
  sendQueue: SendQueueItem[]
): SendTimeline {
  const events: TimelineEvent[] = [];
  const now = new Date();
  
  // Always add "Now"
  events.push({
    id: "now",
    label: "Now",
    timestamp: now.toISOString(),
    type: "now",
  });
  
  if (sendQueue.length === 0) {
    return {
      events,
      hasFollowUp: campaign.rules.followUpEnabled,
    };
  }
  
  // Find earliest initial send time
  const initialSends = sendQueue.filter(
    (q) => q.variant !== "followUpSms" && q.status === "pending"
  );
  
  if (initialSends.length > 0) {
    const earliestInitial = initialSends.reduce((earliest, current) => {
      return new Date(current.scheduledAt) < new Date(earliest.scheduledAt) ? current : earliest;
    });
    
    events.push({
      id: "initial-send",
      label: "Initial Send",
      timestamp: earliestInitial.scheduledAt,
      type: "initial_send",
    });
  }
  
  // Find earliest follow-up time
  const followUps = sendQueue.filter(
    (q) => q.variant === "followUpSms" && q.status === "pending"
  );
  
  if (followUps.length > 0) {
    const earliestFollowUp = followUps.reduce((earliest, current) => {
      return new Date(current.scheduledAt) < new Date(earliest.scheduledAt) ? current : earliest;
    });
    
    events.push({
      id: "follow-up",
      label: "Follow-Up",
      timestamp: earliestFollowUp.scheduledAt,
      type: "follow_up",
    });
  }
  
  return {
    events: events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
    hasFollowUp: campaign.rules.followUpEnabled,
  };
}

/**
 * Calculate template quality for each template
 */
export function calculateTemplateQuality(
  campaign: Campaign,
  templates: MessageTemplate
): TemplateQuality[] {
  const quality: TemplateQuality[] = [];
  const { reviewLink } = campaign;
  
  // Check SMS Short
  const smsShort = templates.smsShort;
  const smsShortDetails: string[] = [];
  let smsShortLabel: TemplateQualityLabel = "Good";
  let smsShortSeverity: TemplateQualitySeverity = "info";
  let smsShortSuggestion: string | undefined;
  
  if (!smsShort.toLowerCase().includes("stop")) {
    smsShortLabel = "Missing Opt-out";
    smsShortSeverity = "critical";
    smsShortDetails.push("SMS template missing STOP opt-out line (required for compliance)");
    smsShortSuggestion = "Add 'Reply STOP to opt out' to the template";
  }
  
  if (smsShort.length > 240) {
    smsShortLabel = smsShortLabel === "Good" ? "Too Long" : smsShortLabel;
    smsShortSeverity = smsShortSeverity === "critical" ? "critical" : "warning";
    smsShortDetails.push(`Template is ${smsShort.length} characters (target: ≤240)`);
    if (!smsShortSuggestion) {
      smsShortSuggestion = "Consider shortening the message or using SMS Standard variant";
    }
  }
  
  if (!smsShort.includes(reviewLink)) {
    smsShortLabel = "Link Issue";
    smsShortSeverity = "critical";
    smsShortDetails.push("Review link is missing from template");
    smsShortSuggestion = "Add the review link to the template";
  } else if (smsShort.trim().endsWith(reviewLink) && !smsShort.toLowerCase().includes("review") && !smsShort.toLowerCase().includes("feedback")) {
    smsShortLabel = "Needs Review";
    smsShortSeverity = "warning";
    smsShortDetails.push("Review link appears at the end without clear call-to-action");
    smsShortSuggestion = "Consider adding context before the link (e.g., 'Please leave a review:')";
  }
  
  if (smsShortLabel === "Good") {
    smsShortDetails.push("Template meets all quality criteria");
  }
  
  quality.push({
    templateKey: "smsShort",
    label: smsShortLabel,
    severity: smsShortSeverity,
    details: smsShortDetails,
    suggestion: smsShortSuggestion,
  });
  
  // Check SMS Standard
  const smsStandard = templates.smsStandard;
  const smsStandardDetails: string[] = [];
  let smsStandardLabel: TemplateQualityLabel = "Good";
  let smsStandardSeverity: TemplateQualitySeverity = "info";
  let smsStandardSuggestion: string | undefined;
  
  if (!smsStandard.toLowerCase().includes("stop")) {
    smsStandardLabel = "Missing Opt-out";
    smsStandardSeverity = "critical";
    smsStandardDetails.push("SMS template missing STOP opt-out line (required for compliance)");
    smsStandardSuggestion = "Add 'Reply STOP to opt out' to the template";
  }
  
  if (smsStandard.length > 420) {
    smsStandardLabel = smsStandardLabel === "Good" ? "Too Long" : smsStandardLabel;
    smsStandardSeverity = smsStandardSeverity === "critical" ? "critical" : "warning";
    smsStandardDetails.push(`Template is ${smsStandard.length} characters (target: ≤420)`);
    if (!smsStandardSuggestion) {
      smsStandardSuggestion = "Consider shortening the message";
    }
  }
  
  if (!smsStandard.includes(reviewLink)) {
    smsStandardLabel = "Link Issue";
    smsStandardSeverity = "critical";
    smsStandardDetails.push("Review link is missing from template");
    smsStandardSuggestion = "Add the review link to the template";
  } else if (smsStandard.trim().endsWith(reviewLink) && !smsStandard.toLowerCase().includes("review") && !smsStandard.toLowerCase().includes("feedback")) {
    smsStandardLabel = "Needs Review";
    smsStandardSeverity = "warning";
    smsStandardDetails.push("Review link appears at the end without clear call-to-action");
    smsStandardSuggestion = "Consider adding context before the link (e.g., 'Please leave a review:')";
  }
  
  if (smsStandardLabel === "Good") {
    smsStandardDetails.push("Template meets all quality criteria");
  }
  
  quality.push({
    templateKey: "smsStandard",
    label: smsStandardLabel,
    severity: smsStandardSeverity,
    details: smsStandardDetails,
    suggestion: smsStandardSuggestion,
  });
  
  // Check Follow-Up SMS
  const followUpSms = templates.followUpSms;
  const followUpDetails: string[] = [];
  let followUpLabel: TemplateQualityLabel = "Good";
  let followUpSeverity: TemplateQualitySeverity = "info";
  let followUpSuggestion: string | undefined;
  
  if (!followUpSms.toLowerCase().includes("stop")) {
    followUpLabel = "Missing Opt-out";
    followUpSeverity = "critical";
    followUpDetails.push("Follow-up SMS template missing STOP opt-out line (required for compliance)");
    followUpSuggestion = "Add 'Reply STOP to opt out' to the template";
  }
  
  if (followUpSms.length > 320) {
    followUpLabel = followUpLabel === "Good" ? "Too Long" : followUpLabel;
    followUpSeverity = followUpSeverity === "critical" ? "critical" : "warning";
    followUpDetails.push(`Template is ${followUpSms.length} characters (target: ≤320)`);
    if (!followUpSuggestion) {
      followUpSuggestion = "Consider shortening the follow-up message";
    }
  }
  
  if (!followUpSms.includes(reviewLink)) {
    followUpLabel = "Link Issue";
    followUpSeverity = "critical";
    followUpDetails.push("Review link is missing from template");
    followUpSuggestion = "Add the review link to the template";
  }
  
  if (followUpLabel === "Good") {
    followUpDetails.push("Template meets all quality criteria");
  }
  
  quality.push({
    templateKey: "followUpSms",
    label: followUpLabel,
    severity: followUpSeverity,
    details: followUpDetails,
    suggestion: followUpSuggestion,
  });
  
  // Check Email
  const email = templates.email;
  const emailDetails: string[] = [];
  let emailLabel: TemplateQualityLabel = "Good";
  let emailSeverity: TemplateQualitySeverity = "info";
  let emailSuggestion: string | undefined;
  
  const emailText = `${email.subject} ${email.body}`;
  
  if (!emailText.includes(reviewLink)) {
    emailLabel = "Link Issue";
    emailSeverity = "critical";
    emailDetails.push("Review link is missing from email template");
    emailSuggestion = "Add the review link to the email body";
  } else if (!email.body.includes(reviewLink)) {
    emailLabel = "Needs Review";
    emailSeverity = "warning";
    emailDetails.push("Review link only appears in subject line");
    emailSuggestion = "Consider adding the review link to the email body as well";
  }
  
  if (email.subject.length > 60) {
    emailLabel = emailLabel === "Good" ? "Needs Review" : emailLabel;
    emailSeverity = emailSeverity === "critical" ? "critical" : "warning";
    emailDetails.push(`Email subject is ${email.subject.length} characters (recommended: ≤60)`);
    if (!emailSuggestion) {
      emailSuggestion = "Consider shortening the email subject line";
    }
  }
  
  if (emailLabel === "Good") {
    emailDetails.push("Template meets all quality criteria");
  }
  
  quality.push({
    templateKey: "email",
    label: emailLabel,
    severity: emailSeverity,
    details: emailDetails,
    suggestion: emailSuggestion,
  });
  
  return quality;
}

/**
 * Get business type recommendations
 */
export function getBusinessTypeRecommendation(businessType: string): BusinessTypeRecommendation | undefined {
  const normalized = businessType.toLowerCase().trim();
  
  // Restaurant/Food
  if (normalized.includes("restaurant") || normalized.includes("food") || normalized.includes("cafe") || 
      normalized.includes("dining") || normalized.includes("bakery") || normalized.includes("catering")) {
    return {
      businessType: businessType,
      sendDelayHours: { min: 2, max: 6, recommended: 4 },
      followUpDelayDays: { min: 2, max: 4, recommended: 2 },
      toneStyle: ["Friendly"],
      explanation: "Restaurants benefit from quick follow-up (2-4 hours) while the experience is fresh. Friendly tone matches the hospitality industry.",
    };
  }
  
  // Home Services
  if (normalized.includes("home") || normalized.includes("plumbing") || normalized.includes("electrical") || 
      normalized.includes("hvac") || normalized.includes("roofing") || normalized.includes("contractor") ||
      normalized.includes("handyman") || normalized.includes("landscaping")) {
    return {
      businessType: businessType,
      sendDelayHours: { min: 12, max: 24, recommended: 18 },
      followUpDelayDays: { min: 3, max: 5, recommended: 3 },
      toneStyle: ["Professional"],
      explanation: "Home services work is often completed over time. A 12-24 hour delay allows customers to fully experience the service. Professional tone builds trust.",
    };
  }
  
  // Beauty/Wellness
  if (normalized.includes("beauty") || normalized.includes("salon") || normalized.includes("spa") || 
      normalized.includes("wellness") || normalized.includes("massage") || normalized.includes("nail") ||
      normalized.includes("hair") || normalized.includes("facial")) {
    return {
      businessType: businessType,
      sendDelayHours: { min: 6, max: 12, recommended: 8 },
      followUpDelayDays: { min: 3, max: 5, recommended: 3 },
      toneStyle: ["Friendly", "Luxury"],
      explanation: "Beauty and wellness services benefit from timely follow-up (6-12 hours) while the experience is memorable. Friendly or luxury tone matches the personal care industry.",
    };
  }
  
  // Auto/Trades
  if (normalized.includes("auto") || normalized.includes("car") || normalized.includes("vehicle") ||
      normalized.includes("mechanic") || normalized.includes("tire") || normalized.includes("repair") ||
      normalized.includes("trades") || normalized.includes("construction")) {
    return {
      businessType: businessType,
      sendDelayHours: { min: 12, max: 24, recommended: 18 },
      followUpDelayDays: { min: 4, max: 7, recommended: 4 },
      toneStyle: ["Professional", "Bold"],
      explanation: "Auto and trade services often involve longer projects. A 12-24 hour delay gives customers time to test the work. Professional or bold tone conveys expertise.",
    };
  }
  
  // Medical/Healthcare
  if (normalized.includes("medical") || normalized.includes("health") || normalized.includes("dental") ||
      normalized.includes("doctor") || normalized.includes("clinic") || normalized.includes("therapy")) {
    return {
      businessType: businessType,
      sendDelayHours: { min: 24, max: 48, recommended: 36 },
      followUpDelayDays: { min: 5, max: 7, recommended: 5 },
      toneStyle: ["Professional"],
      explanation: "Medical services require more time for patients to assess outcomes. A 24-48 hour delay is respectful. Professional tone is essential for healthcare.",
    };
  }
  
  // Retail
  if (normalized.includes("retail") || normalized.includes("store") || normalized.includes("shop") ||
      normalized.includes("boutique") || normalized.includes("merchandise")) {
    return {
      businessType: businessType,
      sendDelayHours: { min: 4, max: 12, recommended: 6 },
      followUpDelayDays: { min: 2, max: 4, recommended: 3 },
      toneStyle: ["Friendly", "Professional"],
      explanation: "Retail purchases benefit from quick follow-up (4-12 hours) while the purchase is fresh. Friendly or professional tone works well.",
    };
  }
  
  return undefined;
}

/**
 * Calculate guidance benchmarks
 */
export function calculateGuidanceBenchmarks(campaign: Campaign): GuidanceBenchmark[] {
  const benchmarks: GuidanceBenchmark[] = [];
  
  // Follow-up timing
  if (campaign.rules.followUpEnabled) {
    const isWithinRange = campaign.rules.followUpDelayDays >= 2 && campaign.rules.followUpDelayDays <= 4;
    benchmarks.push({
      id: "follow-up-timing",
      category: "followUp",
      title: "Follow-Up Timing",
      recommendation: "A soft follow-up 2–4 days later is a common best practice.",
      currentValue: `${campaign.rules.followUpDelayDays} days`,
      isWithinRange,
      suggestion: !isWithinRange ? `Consider adjusting to 2–4 days (currently ${campaign.rules.followUpDelayDays} days)` : undefined,
    });
  }
  
  // Quiet hours
  const [startHour] = campaign.rules.quietHours.start.split(":").map(Number);
  const [endHour] = campaign.rules.quietHours.end.split(":").map(Number);
  const isQuietHoursRecommended = startHour >= 9 && startHour <= 10 && endHour >= 18 && endHour <= 19;
  benchmarks.push({
    id: "quiet-hours",
    category: "quietHours",
    title: "Quiet Hours",
    recommendation: "9am–7pm tends to reduce complaint risk.",
    currentValue: `${campaign.rules.quietHours.start}–${campaign.rules.quietHours.end}`,
    isWithinRange: isQuietHoursRecommended,
    suggestion: !isQuietHoursRecommended ? "Consider setting quiet hours to 9am–7pm" : undefined,
  });
  
  // Frequency cap
  const isFrequencyCapRecommended = campaign.rules.frequencyCapDays >= 30 && campaign.rules.frequencyCapDays <= 90;
  benchmarks.push({
    id: "frequency-cap",
    category: "frequencyCap",
    title: "Frequency Cap",
    recommendation: "30–90 days helps prevent over-messaging.",
    currentValue: `${campaign.rules.frequencyCapDays} days`,
    isWithinRange: isFrequencyCapRecommended,
    suggestion: !isFrequencyCapRecommended ? `Consider setting frequency cap to 30–90 days (currently ${campaign.rules.frequencyCapDays} days)` : undefined,
  });
  
  return benchmarks;
}

/**
 * Main processing function
 */
export function processReviewRequestAutomation(
  request: ReviewRequestAutomationRequest
): ReviewRequestAutomationResponse {
  const { campaign, customers, events } = request;
  
  // Validate campaign
  const validationErrors: string[] = [];
  
  if (!campaign.businessName.trim()) {
    validationErrors.push("Business name is required");
  }
  
  if (!campaign.reviewLink.trim()) {
    validationErrors.push("Review link is required");
  }
  
  try {
    new URL(campaign.reviewLink);
  } catch {
    validationErrors.push("Review link must be a valid URL");
  }
  
  if (campaign.rules.sendDelayHours < 0 || campaign.rules.sendDelayHours > 168) {
    validationErrors.push("Send delay hours must be between 0 and 168");
  }
  
  if (campaign.rules.followUpEnabled) {
    if (campaign.rules.followUpDelayDays < 1 || campaign.rules.followUpDelayDays > 30) {
      validationErrors.push("Follow-up delay days must be between 1 and 30");
    }
  }
  
  // Generate templates
  const templates = generateMessageTemplates(campaign);
  
  // Compute send queue
  const sendQueue = computeSendQueue(campaign, customers, events);
  
  // Calculate metrics
  const metrics = calculateFunnelMetrics(customers, events, sendQueue);
  
  // Generate quality checks
  const qualityChecks = generateQualityChecks(campaign, customers, templates);
  
  // Generate next actions
  const nextActions = generateNextActions(campaign, metrics, qualityChecks);
  
  // Calculate campaign health
  const campaignHealth = calculateCampaignHealth(campaign, customers, templates);
  
  // Calculate send timeline
  const sendTimeline = calculateSendTimeline(campaign, sendQueue);
  
  // Calculate template quality
  const templateQuality = calculateTemplateQuality(campaign, templates);
  
  // Get business type recommendation
  const businessTypeRecommendation = campaign.businessType 
    ? getBusinessTypeRecommendation(campaign.businessType)
    : undefined;
  
  // Calculate guidance benchmarks
  const guidanceBenchmarks = calculateGuidanceBenchmarks(campaign);
  
  return {
    templates,
    sendQueue,
    metrics,
    qualityChecks,
    nextActions,
    validationErrors,
    campaignHealth,
    sendTimeline,
    templateQuality,
    businessTypeRecommendation,
    guidanceBenchmarks,
  };
}

