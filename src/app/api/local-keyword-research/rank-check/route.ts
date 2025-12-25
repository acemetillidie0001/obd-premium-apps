// src/app/api/local-keyword-research/rank-check/route.ts

import { NextResponse } from "next/server";
import { checkRank } from "@/lib/local-rank-check";
import type { RankCheckResult } from "../types";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body?.keyword || typeof body.keyword !== "string" || !body.keyword.trim()) {
      return NextResponse.json(
        {
          error: "Missing required field: keyword is required.",
        },
        { status: 400 }
      );
    }

    if (!body?.targetUrl || typeof body.targetUrl !== "string" || !body.targetUrl.trim()) {
      return NextResponse.json(
        {
          error: "Missing required field: targetUrl is required.",
        },
        { status: 400 }
      );
    }

    // Sanitize and set defaults
    const keyword = body.keyword.toString().trim().slice(0, 200);
    const targetUrl = body.targetUrl.toString().trim().slice(0, 500);
    const city = (body.city || "Ocala").toString().trim().slice(0, 120);
    const state = (body.state || "Florida").toString().trim().slice(0, 120);

    // Call rank check helper
    const raw = await checkRank(keyword, targetUrl, city, state);

    // Normalize to RankCheckResult
    const result: RankCheckResult = {
      keyword: raw.keyword,
      targetUrl: raw.targetUrl,
      currentPositionOrganic: raw.currentPositionOrganic ?? null,
      currentPositionMaps: raw.currentPositionMaps ?? null,
      serpSampleUrls: raw.serpSampleUrls || [],
      checkedAt: raw.checkedAt || new Date().toISOString(),
      dataSource: raw.dataSource || "mock",
    };

    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    console.error("Rank check API error:", err);
    return NextResponse.json(
      {
        error:
          "Something went wrong while checking your ranking. Please try again.",
      },
      { status: 500 }
    );
  }
}

