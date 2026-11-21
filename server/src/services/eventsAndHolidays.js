export const INDIAN_HOLIDAYS_AND_EVENTS = [
  {
    key: 'makar_sankranti',
    name: 'Makar Sankranti / Pongal / Lohri',
    month: 1,
    day: 14,
    type: 'holiday',
    title: '🌾 Happy Makar Sankranti & Pongal!',
    body: 'Wishing all farmers a bountiful harvest, prosperous crops, and sunny days ahead. Check your winter crop health today.',
    actionUrl: '/dashboard'
  },
  {
    key: 'republic_day',
    name: 'Republic Day',
    month: 1,
    day: 26,
    type: 'holiday',
    title: '🇮🇳 Happy Republic Day!',
    body: 'Saluting our Annadatas whose hard work feeds the entire nation. May your farms thrive with abundance.',
    actionUrl: '/schemes'
  },
  {
    key: 'zaid_season',
    name: 'Zaid Summer Crop Sowing Window',
    month: 3,
    day: 1,
    type: 'event',
    title: '☀️ Zaid Season Sowing Window Open',
    body: 'Ideal time for planting short-duration summer crops: Watermelon, Muskmelon, Cucumber, and Moong. Plan irrigation needs.',
    actionUrl: '/crops'
  },
  {
    key: 'baisakhi',
    name: 'Baisakhi / Ugadi / Vishu',
    month: 4,
    day: 13,
    type: 'holiday',
    title: '🌾 Baisakhi & New Harvest Greetings!',
    body: 'Celebrate the golden Rabi harvest! Check prevailing Mandi prices to plan the best market arrivals.',
    actionUrl: '/markets'
  },
  {
    key: 'kharif_season',
    name: 'Kharif Monsoon Sowing Begins',
    month: 6,
    day: 1,
    type: 'event',
    title: '🌧️ Kharif Sowing Window Active',
    body: 'Southwest monsoon arrival season: Prep soil and seeds for Paddy, Cotton, Soybean, and Maize. Check 7-day weather outlook.',
    actionUrl: '/weather'
  },
  {
    key: 'independence_day',
    name: 'Independence Day',
    month: 8,
    day: 15,
    type: 'holiday',
    title: '🇮🇳 Happy Independence Day!',
    body: 'Celebrating the pillars of our self-reliant agriculture. Explore government subsidies and farmer welfare schemes today.',
    actionUrl: '/schemes'
  },
  {
    key: 'gandhi_jayanti',
    name: 'Gandhi Jayanti',
    month: 10,
    day: 2,
    type: 'holiday',
    title: '🕊️ Happy Gandhi Jayanti',
    body: '“To forget how to dig the earth and tend the soil is to forget ourselves.” Wishing sustainable prosperity to all farms.',
    actionUrl: '/dashboard'
  },
  {
    key: 'rabi_season',
    name: 'Rabi Winter Crop Sowing Window',
    month: 10,
    day: 15,
    type: 'event',
    title: '🌱 Rabi Sowing Season Kickoff',
    body: 'Ensure adequate soil moisture for sowing Wheat, Mustard, Gram, and Barley. Consult AI advisor for seed treatment.',
    actionUrl: '/crops'
  },
  {
    key: 'diwali',
    name: 'Diwali - Festival of Lights',
    month: 11,
    day: 1,
    type: 'holiday',
    title: '🪔 Happy Diwali & Saal Mubarak!',
    body: 'May the festival of lights bring health, wealth, and record crop yields to your home and fields.',
    actionUrl: '/dashboard'
  },
  {
    key: 'kisan_diwas',
    name: 'National Farmers’ Day (Kisan Diwas)',
    month: 12,
    day: 23,
    type: 'holiday',
    title: '🚜 Happy National Farmers’ Day (Kisan Diwas)!',
    body: 'Thank you for your tireless dedication to farming. Discover our latest AI advisory features to boost your farm income.',
    actionUrl: '/assistant'
  }
];

export const RECENT_FEATURE_ANNOUNCEMENTS = [
  {
    key: 'fcm_instant_notifications',
    title: '🚀 New Feature: Instant Holiday & Event Notifications',
    body: 'Stay informed with immediate real-time push alerts on festive holidays, seasonal sowing windows, and market changes.',
    type: 'feature',
    actionUrl: '/dashboard',
    icon: 'bell'
  },
  {
    key: 'indic_voice_multilingual',
    title: '🎙️ New Feature: Voice Advisory in 13 Indian Languages',
    body: 'Speak or listen in Hindi, Kannada, Marathi, Tamil, Telugu, and more with our built-in Sarvam AI voice assistant.',
    type: 'feature',
    actionUrl: '/assistant',
    icon: 'mic'
  },
  {
    key: 'seven_day_farm_planner',
    title: '📊 New Feature: 7-Day Farm Planning & Weather Risk Alerts',
    body: 'Get advance alerts on heavy downpours, dry spells, and heat stress before they impact your standing crops.',
    type: 'feature',
    actionUrl: '/weather',
    icon: 'calendar'
  },
  {
    key: 'redis_fast_caching',
    title: '⚡ New Feature: Blazing-Fast Mandi & Weather Data',
    body: 'Enjoy instantaneous loading for mandi price comparisons and multi-day local weather forecasts with our new cache layer.',
    type: 'feature',
    actionUrl: '/markets',
    icon: 'zap'
  }
];

export function getUpcomingHolidaysAndEvents(referenceDate = new Date(), daysAhead = 45) {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentDay = referenceDate.getDate();

  return INDIAN_HOLIDAYS_AND_EVENTS.map(item => {
    let daysUntil;
    if (item.month === currentMonth) {
      daysUntil = item.day - currentDay;
    } else if (item.month > currentMonth) {
      daysUntil = (item.month - currentMonth) * 30 + (item.day - currentDay);
    } else {
      daysUntil = (12 - currentMonth + item.month) * 30 + (item.day - currentDay);
    }
    return { ...item, daysUntil };
  }).filter(item => item.daysUntil >= 0 && item.daysUntil <= daysAhead)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function detectActiveHolidayOrEvent(referenceDate = new Date()) {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentDay = referenceDate.getDate();

  // Match exact date or within next 2 days
  const exact = INDIAN_HOLIDAYS_AND_EVENTS.find(
    item => item.month === currentMonth && Math.abs(item.day - currentDay) <= 2
  );
  if (exact) return exact;

  // Fallback to the nearest upcoming event
  const upcoming = getUpcomingHolidaysAndEvents(referenceDate, 365);
  return upcoming[0] || INDIAN_HOLIDAYS_AND_EVENTS[0];
}
