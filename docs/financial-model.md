# Aura Financial Projections

## Revenue Model

### Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 1 analysis/month, basic routine, limited product recs |
| **Basic** | $9.99/mo | 4 analyses/month, full routines, product recommendations |
| **Premium** | $24.99/mo | Unlimited analyses, adaptive learning, skin journey timeline, priority support |
| **VIP** | $49.99/mo | All Premium features + concierge skin coaching, exclusive product access |

### Assumptions
- Free-to-paid conversion: **5%**
- Tier distribution (of paid users): **60% Basic / 30% Premium / 10% VIP**
- Monthly churn rate: **5%** (industry average for subscription apps)
- Average revenue per paid user (ARPU): **$17.50/mo** (weighted by tier distribution)

## Cost Structure

### Fixed Monthly Costs

| Item | Cost | Notes |
|------|------|-------|
| Supabase Pro | $25/mo | Includes 8GB DB, 250GB bandwidth, 100GB storage |
| Vercel Pro | $20/mo | Hosting, edge functions, analytics |
| Domain | $1/mo | ~$12/year amortized |
| **Total Fixed** | **$46/mo** | |

### Variable Costs (Per User)

| Item | Cost | Notes |
|------|------|-------|
| Gemini API | ~$0.003/analysis | Vision model pricing (gemini-2.0-flash) |
| Supabase Storage | ~$0.021/GB/mo | Photo storage (~2MB avg per photo) |
| Supabase Bandwidth | Included | Up to 250GB on Pro plan |

### Per-User Monthly Cost Estimate
- Avg analyses/month: 3 (across tiers)
- Avg photos stored: 4 (rolling 30-day retention)
- Storage per user: ~8MB = ~$0.0002/mo
- AI cost per user: 3 × $0.003 = $0.009/mo
- **Total variable cost/user: ~$0.01/mo**

## Growth Projections

### Assumptions
- Month 1 users: **200** (organic + social media launch)
- Monthly growth rate: **20%** (decreasing to 15% after month 6)
- Free-to-paid conversion: **5%**

### 12-Month Projection

| Month | Total Users | Paid Users | Monthly Revenue | Monthly Cost | Net |
|-------|-------------|------------|-----------------|--------------|-----|
| 1 | 200 | 10 | $175 | $46 | $129 |
| 2 | 240 | 12 | $210 | $46 | $164 |
| 3 | 288 | 14 | $245 | $46 | $199 |
| 4 | 346 | 17 | $298 | $47 | $251 |
| 5 | 415 | 21 | $368 | $47 | $321 |
| 6 | 498 | 25 | $438 | $47 | $391 |
| 7 | 573 | 29 | $508 | $47 | $461 |
| 8 | 659 | 33 | $578 | $48 | $530 |
| 9 | 758 | 38 | $665 | $48 | $617 |
| 10 | 871 | 44 | $770 | $49 | $721 |
| 11 | 1,002 | 50 | $875 | $49 | $826 |
| 12 | 1,152 | 58 | $1,015 | $50 | $965 |

### Cumulative at Month 12
- **Total Revenue**: ~$6,145
- **Total Costs**: ~$570
- **Net Profit**: ~$5,575
- **Break-even**: Month 1 (costs are minimal on Supabase free/pro tier)

## Scaling Thresholds

| Users | Trigger | Cost Change |
|-------|---------|-------------|
| 1,000 | Supabase Pro adequate | No change |
| 5,000 | May need Supabase Team ($599/mo) | +$574/mo |
| 10,000 | Vercel Enterprise, CDN for images | +$200-500/mo |
| 50,000+ | Dedicated infrastructure, caching | Custom pricing |

### Gemini API Scaling
- 10,000 analyses/month = ~$30/mo (trivial)
- 100,000 analyses/month = ~$300/mo (still manageable)
- Cost scales linearly, no step functions

### Storage Scaling
- 10,000 users × 8MB = 80GB storage (~$1.68/mo)
- 100,000 users × 8MB = 800GB storage (~$16.80/mo)
- Auto-delete after 30 days keeps this manageable

## Revenue Optimization Opportunities

1. **Affiliate product links**: Earn 5-10% commission on recommended products
2. **Brand partnerships**: Curated product placements in routines
3. **Annual subscriptions**: 20% discount = better retention, upfront cash flow
4. **Enterprise/clinic licensing**: White-label version for dermatology clinics
5. **Data insights**: Anonymized, aggregated skin trend reports (requires explicit consent)

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Low conversion rate | Revenue shortfall | Focus on onboarding, free-tier value |
| High churn | Revenue decline | Adaptive routines, engagement features |
| Gemini API price increase | Cost increase | Budget buffer, alternative models |
| Competition | User acquisition cost | Brand differentiation, community |

---

*All projections use conservative assumptions. Actual results may vary. Review and update monthly.*
