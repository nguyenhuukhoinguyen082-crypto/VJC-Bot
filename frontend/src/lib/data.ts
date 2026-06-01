import branding from "@/config/branding.json";
import type { FleetAircraft, TeamMember } from "./types";

export const fleetData: FleetAircraft[] = branding.fleet as FleetAircraft[];
export const teamData: TeamMember[] = branding.team as TeamMember[];
export const airports: Record<string, string> = branding.airports;
