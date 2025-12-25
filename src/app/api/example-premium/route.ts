import { NextRequest, NextResponse } from "next/server";
import { hasPremiumAccess, getCurrentUser } from "@/lib/premium";

/**
 * Example API route demonstrating premium gating
 * 
 * This route requires premium access. Non-premium users will receive a 403 error.
 * Premium users and admins can access this endpoint.
 */
export async function GET() {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  const hasPremium = await hasPremiumAccess();
  
  if (!hasPremium) {
    return NextResponse.json(
      { 
        error: "Premium subscription required",
        upgradeUrl: "https://ocalabusinessdirectory.com/for-business-owners/",
      },
      { status: 403 }
    );
  }
  
  // Premium feature logic here
  return NextResponse.json({
    message: "Premium feature accessed successfully",
    user: {
      email: user.email,
      role: user.role,
      isPremium: user.isPremium,
    },
  });
}

