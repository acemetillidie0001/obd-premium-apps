import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

// For signature verification we can use the static Webhooks helper (no API key needed).
const stripe = Stripe;

function methodNotAllowed() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

export function GET() {
  return methodNotAllowed();
}

export function HEAD() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export function OPTIONS() {
  return methodNotAllowed();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    console.error("Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log({
    type: event.type,
    id: event.id,
    created: event.created,
    livemode: event.livemode,
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log({
      businessId: session.metadata?.businessId,
      plan: session.metadata?.plan,
      customer: session.customer,
      subscription: session.subscription,
    });
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    console.log({
      customer: sub.customer,
      subscriptionId: sub.id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  }

  return NextResponse.json({ received: true });
}

