// Bamboo Airways — Shared TypeScript Types

export interface User {
  nickname: string;
  email: string;
  group: "dev" | "director" | "staff" | "user";
  money: number;
  flightmiles: number;
  achievement: string[];
  createdAt: number;
  lastLogin: number;
  discordID: number;
  banned: boolean;
  verified?: boolean;
  referred_by?: string;
  ip_address?: string;
  referrals?: {
    count: number;
    users: string[];
    total_rewards: number;
  };
  transactions?: Transaction[];
  moderation?: ModerationRecord;
  jobs?: Record<string, { count: number; earned: number }>;
  upcoming_flight?: {
    flight_id: string;
    flight: string;
    departure_icao: string;
    arrival_icao: string;
    timestamp: number;
    seat: string;
    class: string;
  } | null;
}

export interface Transaction {
  type: string;
  amount: number;
  reason?: string;
  to?: string;
  from?: string;
  job?: string;
  flight?: string;
  seat?: string;
  referrer?: string;
  referred_user?: string;
  timestamp: number;
}

export interface Flight {
  flight: string;
  departure: AirportInfo;
  arrival: AirportInfo;
  aircraft: string;
  pax: number;
  status: "scheduled" | "boarding" | "departed" | "landed" | "cancelled" | "delayed";
  price: Record<string, number>;
  seating: Record<string, string>;
}

export interface AirportInfo {
  "ingame-icao": string;
  icao: string;
  name: string;
  timestamp: number;
}

export interface SeatmapConfig {
  letter: string[];
  row?: [number, number];
  number?: [number, number];
}

export interface AircraftSeatmap {
  [className: string]: SeatmapConfig;
}

export interface ModerationRecord {
  ban?: {
    reason: string;
    banned_at: number;
    banned_by: string;
    expires_at?: number;
    type: "tempban" | "permanent";
  };
  ban_history?: Array<{
    reason: string;
    banned_at: number;
    banned_by: string;
    unbanned_at: number;
    unbanned_by: string;
    unban_reason: string;
  }>;
  warnings?: Array<{
    reason: string;
    warned_at: number;
    warned_by: string;
    expires_at: number;
  }>;
  kicks?: Array<{
    reason: string;
    kicked_at: number;
    kicked_by: string;
  }>;
  blacklisted?: {
    reason: string;
    blacklisted_at: number;
    blacklisted_by: string;
  };
  suspicions?: Array<{
    reason: string;
    flagged_at: number;
    flagged_by: string;
  }>;
}

export interface ApiError {
  code: number;
  message: string;
  field?: string;
}

export interface LeaderboardEntry {
  user_id: string;
  nickname: string;
  money: number;
  flightmiles: number;
}

export interface Job {
  name: string;
  pay_range: [number, number];
}

export interface AnalyticsReport {
  date?: string;
  period?: string;
  new_registrations: number;
  total_users: number;
  total_money: number;
  total_miles: number;
  bookings_made: number;
  total_flights: number;
}

export interface FleetAircraft {
  registration: string;
  model: string;
  type: "Narrow-Body" | "Wide-Body";
  capacity: string;
  firstFlight: number;
  status: "Active" | "Retired" | "Stored";
  range?: string;
  engines?: string;
  image?: string;
}

export interface TeamMember {
  username: string;
  title: string;
  department: string;
  experience: string;
  avatar?: string;
}
