# Brand Profile Auto-Import Status

**Date**: 2025-01-XX  
**Status**: COMPLETE / LOCKED / MAINTENANCE-ONLY

## Overview

Brand Profile auto-import system provides suite-wide automatic hydration of brand profile data into app forms, with tenant-safe caching and user controls.

## Core Behaviors

- **Auto-import**: Runs once per page load when enabled (per-app toggle, defaults to ON if brand profile exists)
- **Fill-empty-only**: Default merge mode preserves existing form values, only fills empty fields
- **Once per page load**: Uses sessionStorage to prevent duplicate runs within a page session
- **Toggle**: User-visible checkbox control per app (persisted to localStorage: `obd.<app>.useBrandProfile`)
- **Toast notification**: One-time toast shown when brand profile is successfully applied to empty fields
- **Status indicators**: UI shows "Saved Brand Profile detected", "Applied to empty fields", or "Create a Brand Profile →" link

## Tenant Safety

- **Business-scoped cache**: localStorage keys scoped by businessId (`obd.brandProfile.v1.<businessId>`)
- **Legacy migration**: Automatic migration from legacy global cache to business-scoped cache
- **LocalStorage-first**: Fast cached reads with API fallback for cache misses
- **No server-side mutation**: Read-only API calls, no form state sent to server

## Apps Covered

- Business Description Writer
- Content Writer
- Social Media Post Creator
- Image Caption Generator
- Review Responder
- Local SEO Page Builder
- FAQ Generator
- Event Campaign Builder
- Offers Builder

## Regression Checklist

See [Brand Profile Auto-Import Architecture](../architecture/brand-profile-auto-import.md) for:
- Integration checklist
- Field mapping patterns
- Storage key conventions
- Testing scenarios

