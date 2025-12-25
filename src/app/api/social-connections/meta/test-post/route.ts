import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";

/**
 * POST /api/social-connections/meta/test-post
 * 
 * Publishes a test post to Facebook Page and/or Instagram.
 * Logs attempts to SocialPublishAttempt table.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const body = await request.json().catch(() => ({}));
    const platforms = body.platforms as ("facebook" | "instagram")[] | undefined;

    // Get selected destinations
    const facebookDestination = await prisma.socialPostingDestination.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: "facebook",
        },
      },
    });

    const instagramDestination = await prisma.socialPostingDestination.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: "instagram",
        },
      },
    });

    // Determine which platforms to attempt
    const attemptFacebook = !platforms || platforms.includes("facebook");
    const attemptInstagram = (!platforms || platforms.includes("instagram")) && !!instagramDestination;

    const results: {
      facebook?: { ok: boolean; postId?: string; permalink?: string; error?: string };
      instagram?: { ok: boolean; postId?: string; permalink?: string; error?: string };
    } = {};

    // Test post caption
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const testCaption = `OBD Social Auto-Poster test post ✅ (${timestamp})`;

    // OBD logo URL - use a stable hosted image
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const imageUrl = `${appUrl}/obd-logo.png`;

    // Attempt Facebook post
    if (attemptFacebook && facebookDestination) {
      try {
        const fbConnection = await prisma.socialAccountConnection.findFirst({
          where: {
            userId,
            platform: "facebook",
            providerAccountId: facebookDestination.selectedAccountId,
          },
        });

        if (!fbConnection || !fbConnection.accessToken) {
          results.facebook = {
            ok: false,
            error: "Facebook connection not found",
          };
          
          // Log failure
          await prisma.socialPublishAttempt.create({
            data: {
              userId,
              platform: "facebook",
              kind: "test",
              status: "failed",
              errorMessage: "Facebook connection not found",
            },
          });
        } else {
          // Post to Facebook Page (text-only for reliability)
          const fbPostResponse = await fetch(
            `https://graph.facebook.com/v21.0/${fbConnection.providerAccountId}/feed`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                message: testCaption,
                access_token: fbConnection.accessToken,
              }),
            }
          );

          if (!fbPostResponse.ok) {
            const errorData = await fbPostResponse.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || "Failed to post to Facebook";
            
            results.facebook = {
              ok: false,
              error: errorMessage,
            };

            // Log failure
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "facebook",
                kind: "test",
                status: "failed",
                errorMessage: errorMessage.substring(0, 500), // Limit length
              },
            });
          } else {
            const postData = await fbPostResponse.json();
            const postId = postData.id;

            // Fetch permalink
            let permalink: string | undefined;
            try {
              const permalinkResponse = await fetch(
                `https://graph.facebook.com/v21.0/${postId}?fields=permalink_url&access_token=${fbConnection.accessToken}`
              );
              if (permalinkResponse.ok) {
                const permalinkData = await permalinkResponse.json();
                permalink = permalinkData.permalink_url;
              }
            } catch (err) {
              // Permalink fetch failed, but post succeeded - continue
              console.warn("Failed to fetch Facebook permalink:", err);
            }

            results.facebook = {
              ok: true,
              postId,
              permalink,
            };

            // Log success
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "facebook",
                kind: "test",
                status: "success",
                providerPostId: postId,
                providerPermalink: permalink,
              },
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.facebook = {
          ok: false,
          error: errorMessage,
        };

        // Log failure
        await prisma.socialPublishAttempt.create({
          data: {
            userId,
            platform: "facebook",
            kind: "test",
            status: "failed",
            errorMessage: errorMessage.substring(0, 500),
          },
        });
      }
    }

    // Attempt Instagram post (only if Instagram is connected)
    if (attemptInstagram && instagramDestination) {
      try {
        const igConnection = await prisma.socialAccountConnection.findFirst({
          where: {
            userId,
            platform: "instagram",
            providerAccountId: instagramDestination.selectedAccountId,
          },
        });

        if (!igConnection || !igConnection.accessToken) {
          results.instagram = {
            ok: false,
            error: "Instagram connection not found",
          };

          // Log failure
          await prisma.socialPublishAttempt.create({
            data: {
              userId,
              platform: "instagram",
              kind: "test",
              status: "failed",
              errorMessage: "Instagram connection not found",
            },
          });
        } else {
          const igBusinessId = igConnection.providerAccountId;
          const pageAccessToken = igConnection.accessToken;

          // Step 1: Create media container
          const createContainerResponse = await fetch(
            `https://graph.facebook.com/v21.0/${igBusinessId}/media`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                image_url: imageUrl,
                caption: testCaption,
                access_token: pageAccessToken,
              }),
            }
          );

          if (!createContainerResponse.ok) {
            const errorData = await createContainerResponse.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || "Failed to create Instagram media container";
            
            // Check for common errors
            let userFriendlyError = errorMessage;
            if (errorMessage.includes("permission") || errorMessage.includes("access")) {
              userFriendlyError = "Missing permissions or account not linked to Page";
            } else if (errorMessage.includes("Business") || errorMessage.includes("Creator")) {
              userFriendlyError = "Instagram account not Business/Creator or not linked to Page";
            }

            results.instagram = {
              ok: false,
              error: userFriendlyError,
            };

            // Log failure
            await prisma.socialPublishAttempt.create({
              data: {
                userId,
                platform: "instagram",
                kind: "test",
                status: "failed",
                errorMessage: userFriendlyError.substring(0, 500),
              },
            });
          } else {
            const containerData = await createContainerResponse.json();
            const creationId = containerData.id;

            // Step 2: Publish the container
            const publishResponse = await fetch(
              `https://graph.facebook.com/v21.0/${igBusinessId}/media_publish`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  creation_id: creationId,
                  access_token: pageAccessToken,
                }),
              }
            );

            if (!publishResponse.ok) {
              const errorData = await publishResponse.json().catch(() => ({}));
              const errorMessage = errorData.error?.message || "Failed to publish Instagram post";
              
              results.instagram = {
                ok: false,
                error: errorMessage,
              };

              // Log failure
              await prisma.socialPublishAttempt.create({
                data: {
                  userId,
                  platform: "instagram",
                  kind: "test",
                  status: "failed",
                  errorMessage: errorMessage.substring(0, 500),
                },
              });
            } else {
              const publishData = await publishResponse.json();
              const postId = publishData.id;

              // Fetch permalink from the media object
              let permalink: string | undefined;
              try {
                const permalinkResponse = await fetch(
                  `https://graph.facebook.com/v21.0/${postId}?fields=permalink&access_token=${pageAccessToken}`
                );
                if (permalinkResponse.ok) {
                  const permalinkData = await permalinkResponse.json();
                  permalink = permalinkData.permalink;
                }
              } catch (err) {
                // Permalink fetch failed, but post succeeded - continue
                console.warn("Failed to fetch Instagram permalink:", err);
              }

              // Fallback to constructing permalink from post ID if API doesn't return it
              if (!permalink && postId) {
                permalink = `https://www.instagram.com/p/${postId}/`;
              }

              results.instagram = {
                ok: true,
                postId,
                permalink,
              };

              // Log success
              await prisma.socialPublishAttempt.create({
                data: {
                  userId,
                  platform: "instagram",
                  kind: "test",
                  status: "success",
                  providerPostId: postId,
                  providerPermalink: permalink,
                },
              });
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.instagram = {
          ok: false,
          error: errorMessage,
        };

        // Log failure
        await prisma.socialPublishAttempt.create({
          data: {
            userId,
            platform: "instagram",
            kind: "test",
            status: "failed",
            errorMessage: errorMessage.substring(0, 500),
          },
        });
      }
    }

    const overallOk = Object.values(results).some((r) => r?.ok === true) || Object.keys(results).length === 0;

    return NextResponse.json({
      ok: overallOk,
      results,
    });
  } catch (error) {
    console.error("Error in test post:", error);
    return NextResponse.json(
      { error: "Failed to publish test post" },
      { status: 500 }
    );
  }
}

