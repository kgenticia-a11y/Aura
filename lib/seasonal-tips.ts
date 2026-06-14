interface SeasonalTip {
  season: string;
  emoji: string;
  title: string;
  tip: string;
  action: string;
}

const SEASONAL_TIPS: Record<string, SeasonalTip> = {
  winter: {
    season: "Winter",
    emoji: "❄️",
    title: "Winter Skin Shield",
    tip: "Cold air and indoor heating strip moisture from your skin. Switch to a richer moisturizer and add a hydrating serum with hyaluronic acid.",
    action: "Consider adding an occlusive night cream to lock in hydration.",
  },
  spring: {
    season: "Spring",
    emoji: "🌸",
    title: "Spring Renewal",
    tip: "As humidity rises, lighten up your moisturizer and increase exfoliation to shed winter buildup. Don't forget SPF — UV is stronger than you think.",
    action: "Swap heavy creams for a gel moisturizer and add a gentle AHA.",
  },
  summer: {
    season: "Summer",
    emoji: "☀️",
    title: "Summer Protection",
    tip: "UV exposure peaks now. Use SPF 30+ daily, reapply every 2 hours outdoors, and add antioxidant serums (vitamin C) for extra defense.",
    action: "Prioritize lightweight, non-comedogenic SPF and stay hydrated.",
  },
  fall: {
    season: "Fall",
    emoji: "🍂",
    title: "Fall Recovery",
    tip: "Repair summer sun damage with retinol and nourishing oils. Gradually reintroduce richer products as temperatures drop.",
    action: "Start retinol if you haven't — your skin repairs faster in cooler weather.",
  },
};

function getSeason(month: number, hemisphere: "north" | "south" = "north"): string {
  const northern = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];
  const southern = ["summer", "summer", "fall", "fall", "fall", "winter", "winter", "winter", "spring", "spring", "spring", "summer"];
  return hemisphere === "north" ? northern[month] : southern[month];
}

export function getSeasonalTip(): SeasonalTip {
  const month = new Date().getMonth();
  const season = getSeason(month);
  return SEASONAL_TIPS[season];
}
