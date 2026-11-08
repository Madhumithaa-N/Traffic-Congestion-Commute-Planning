export interface RouteOption {
  id: string;
  name: string;
  via: string;
  duration: string;
  durationMinutes: number;
  distance: string;
  trafficStatus: 'Fast' | 'Moderate' | 'Heavy';
  isRecommended?: boolean;
  pathCoordinates: [number, number][]; // Relative SVG coordinate points [x, y]
  trafficSegments: {
    startIdx: number;
    endIdx: number;
    status: 'Fast' | 'Moderate' | 'Heavy';
  }[];
}

export interface CabService {
  id: string;
  name: string;
  brand: 'Uber' | 'Namma Yatri' | 'Ola';
  estimatedFare: string;
  fareMin: number;
  fareMax: number;
  suggestedDeparture: string;
  estimatedArrival: string;
  duration: string;
  durationMinutes: number;
  tag?: string;
  isHighlighted?: boolean;
  colorScheme: {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
  };
}

export interface TransitService {
  id: string;
  name: string;
  type: 'metro' | 'bus';
  agency: 'Namma Metro' | 'BMTC' | 'BMTC Vajra';
  lineOrRoute: string;
  routeNumber?: string;
  estimatedFare: string;
  fareMin: number;
  fareMax: number;
  suggestedDeparture: string;
  estimatedArrival: string;
  duration: string;
  durationMinutes: number;
  frequency: string;
  tag?: string;
  isHighlighted?: boolean;
  colorScheme: {
    badgeBg: string;
    badgeText: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
  };
  details: {
    boarding: string;
    interchangeOrStops: string;
    alighting: string;
    lastMile: string;
  };
  mapCoordinates?: [number, number][];
}

export interface JourneyData {
  startLocation: string;
  destination: string;
  requiredArrivalTime: string;
  routes: RouteOption[];
  cabServices: CabService[];
  transitServices: TransitService[];
  recommendation: {
    serviceName: string;
    reason: string;
  };
}

export const defaultJourneyData: JourneyData = {
  startLocation: 'Rajajinagar, Bengaluru',
  destination: 'Dr. Ambedkar Institute of Technology, Bengaluru',
  requiredArrivalTime: '9:00 AM',
  routes: [
    {
      id: 'route-1',
      name: 'Route 1',
      via: 'via Mysore Road',
      duration: '40 min',
      durationMinutes: 40,
      distance: '12.4 km',
      trafficStatus: 'Moderate',
      isRecommended: true,
      pathCoordinates: [
        [485, 235], // Rajajinagar origin
        [500, 222],
        [518, 202],
        [540, 204],
        [580, 218],
        [610, 238],
        [635, 246],
        [660, 248],
        [690, 268],
        [730, 278],
        [765, 292],
        [768, 316],
        [778, 322],
        [792, 336], // Dr Ambedkar Institute pin
      ],
      trafficSegments: [
        { startIdx: 0, endIdx: 2, status: 'Fast' },
        { startIdx: 2, endIdx: 8, status: 'Fast' },
        { startIdx: 8, endIdx: 12, status: 'Moderate' },
        { startIdx: 12, endIdx: 16, status: 'Moderate' },
      ],
    },
    {
      id: 'route-2',
      name: 'Route 2',
      via: 'via Tumkur Road',
      duration: '46 min',
      durationMinutes: 46,
      distance: '13.1 km',
      trafficStatus: 'Heavy',
      isRecommended: false,
      pathCoordinates: [
        [485, 235], // Rajajinagar pin origin
        [475, 205],
        [480, 160], // Tumkur road north curve
        [515, 150],
        [565, 155],
        [635, 175],
        [710, 215],
        [750, 260],
        [775, 305],
        [792, 336], // Dr Ambedkar Institute pin
      ],
      trafficSegments: [
        { startIdx: 0, endIdx: 3, status: 'Moderate' },
        { startIdx: 3, endIdx: 6, status: 'Heavy' },
        { startIdx: 6, endIdx: 9, status: 'Heavy' },
      ],
    },
  ],
  cabServices: [
    {
      id: 'uber',
      name: 'Uber',
      brand: 'Uber',
      estimatedFare: '₹220 – ₹280',
      fareMin: 220,
      fareMax: 280,
      suggestedDeparture: '8:10 AM',
      estimatedArrival: '8:50 AM',
      duration: '40 min',
      durationMinutes: 40,
      colorScheme: {
        badgeBg: '',
        badgeText: '',
        badgeBorder: '',
        pillBg: 'bg-blue-50',
        pillText: 'text-blue-600',
        pillBorder: 'border-blue-200',
      },
    },
    {
      id: 'namma-yatri',
      name: 'Namma Yatri',
      brand: 'Namma Yatri',
      estimatedFare: '₹190 – ₹240',
      fareMin: 190,
      fareMax: 240,
      suggestedDeparture: '8:05 AM',
      estimatedArrival: '8:50 AM',
      duration: '45 min',
      durationMinutes: 45,
      tag: 'Best Balance ★',
      isHighlighted: true,
      colorScheme: {
        badgeBg: 'bg-[#16a34a]',
        badgeText: 'text-white',
        badgeBorder: 'border-transparent',
        pillBg: 'bg-emerald-50',
        pillText: 'text-emerald-700',
        pillBorder: 'border-emerald-200',
      },
    },
    {
      id: 'ola',
      name: 'Ola',
      brand: 'Ola',
      estimatedFare: '₹210 – ₹270',
      fareMin: 210,
      fareMax: 270,
      suggestedDeparture: '8:08 AM',
      estimatedArrival: '8:53 AM',
      duration: '45 min',
      durationMinutes: 45,
      colorScheme: {
        badgeBg: '',
        badgeText: '',
        badgeBorder: '',
        pillBg: 'bg-purple-50',
        pillText: 'text-purple-700',
        pillBorder: 'border-purple-200',
      },
    },
  ],
  transitServices: [
    {
      id: 'namma-metro',
      name: 'Namma Metro',
      type: 'metro',
      agency: 'Namma Metro',
      lineOrRoute: 'Green Line ➔ Purple Line',
      estimatedFare: '₹35 – ₹42',
      fareMin: 35,
      fareMax: 42,
      suggestedDeparture: '8:12 AM',
      estimatedArrival: '8:52 AM',
      duration: '40 min',
      durationMinutes: 40,
      frequency: 'Every 5 min',
      tag: '100% Traffic Free ⚡',
      isHighlighted: true,
      colorScheme: {
        badgeBg: 'bg-[#7e22ce]', // Purple Line royal badge
        badgeText: 'text-white',
        pillBg: 'bg-purple-50',
        pillText: 'text-purple-800',
        pillBorder: 'border-purple-200',
      },
      details: {
        boarding: 'Rajajinagar Metro (Green Line)',
        interchangeOrStops: 'Interchange at Majestic (Platform 2)',
        alighting: 'Attiguppe / Deepanjali Nagar (Purple Line)',
        lastMile: '5 min feeder / auto to Dr. AIT campus',
      },
      // Metro route path coordinates via Majestic
      mapCoordinates: [
        [485, 235], // Rajajinagar
        [475, 270],
        [500, 310], // Majestic interchange
        [570, 320],
        [650, 310],
        [740, 325],
        [792, 336], // Dr AIT
      ],
    },
    {
      id: 'bmtc-bus',
      name: 'BMTC City Bus',
      type: 'bus',
      agency: 'BMTC',
      lineOrRoute: 'Route 401-B / 248 Direct',
      routeNumber: '401-B',
      estimatedFare: '₹20 – ₹25',
      fareMin: 20,
      fareMax: 25,
      suggestedDeparture: '8:00 AM',
      estimatedArrival: '8:52 AM',
      duration: '52 min',
      durationMinutes: 52,
      frequency: 'Every 8 min',
      tag: 'Most Economical 💰',
      isHighlighted: false,
      colorScheme: {
        badgeBg: 'bg-[#004085]', // BMTC Blue
        badgeText: 'text-white',
        pillBg: 'bg-blue-50',
        pillText: 'text-blue-800',
        pillBorder: 'border-blue-200',
      },
      details: {
        boarding: 'Rajajinagar 1st Block Bus Stop',
        interchangeOrStops: '18 stops via Chord Road & Ring Rd',
        alighting: 'Dr. AIT Campus Gate Stop',
        lastMile: 'Direct drop at college main arch',
      },
      mapCoordinates: [
        [485, 235],
        [450, 240],
        [460, 280],
        [530, 290],
        [620, 270],
        [720, 290],
        [792, 336],
      ],
    },
    {
      id: 'bmtc-vajra',
      name: 'BMTC Vajra AC',
      type: 'bus',
      agency: 'BMTC Vajra',
      lineOrRoute: 'V-401 AC Express',
      routeNumber: 'V-401',
      estimatedFare: '₹45 – ₹55',
      fareMin: 45,
      fareMax: 55,
      suggestedDeparture: '8:06 AM',
      estimatedArrival: '8:51 AM',
      duration: '45 min',
      durationMinutes: 45,
      frequency: 'Every 15 min',
      tag: 'AC Comfort ❄️',
      isHighlighted: false,
      colorScheme: {
        badgeBg: 'bg-[#0284c7]', // Sky blue / Vajra
        badgeText: 'text-white',
        pillBg: 'bg-cyan-50',
        pillText: 'text-cyan-800',
        pillBorder: 'border-cyan-200',
      },
      details: {
        boarding: 'Navrang Theatre Stop, Rajajinagar',
        interchangeOrStops: 'Limited stops via Vijayanagar',
        alighting: 'Nagarbhavi BDA Complex',
        lastMile: '300m walk to Dr. AIT campus',
      },
      mapCoordinates: [
        [485, 235],
        [500, 230],
        [540, 220],
        [630, 245],
        [710, 275],
        [792, 336],
      ],
    },
  ],
  recommendation: {
    serviceName: 'Namma Yatri',
    reason: 'Best balance: lower estimated fare; leave by 8:05 AM. Or take Namma Metro to completely bypass road traffic!',
  },
};

export const sampleLocations = [
  'Rajajinagar, Bengaluru',
  'Dr. Ambedkar Institute of Technology, Bengaluru',
  'Indiranagar 100ft Road, Bengaluru',
  'Koramangala 5th Block, Bengaluru',
  'Whitefield ITPL, Bengaluru',
  'Electronic City Phase 1, Bengaluru',
  'MG Road Metro Station, Bengaluru',
  'Hebbal Flyover, Bengaluru',
  'Indian Institute of Science (IISc), Bengaluru',
  'Jayanagar 4th Block, Bengaluru',
];
