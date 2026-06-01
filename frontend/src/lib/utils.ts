import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toUnixTimestamp(date: string, time: string): number {
  if (!date || !time) return Math.floor(Date.now() / 1000);
  const dateTimeStr = `${date}T${time}:00`;
  return Math.floor(new Date(dateTimeStr).getTime() / 1000);
}

export function fromUnixTimestamp(timestamp: number): { date: string, time: string } {
  const date = new Date(timestamp * 1000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${min}`
  };
}

export function formatTime(timestamp: number): string {
  const { time } = fromUnixTimestamp(timestamp);
  return time;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
}

export function formatDuration(dep: number, arr: number): string {
    const diff = Math.max(0, arr - dep);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

type SeatmapClassConfig = {
  row?: [number, number];
  number?: [number, number];
  letter?: string[];
};

export function computeSeatCapacity(
  seatmap: Record<string, SeatmapClassConfig> | null | undefined
): number {
  if (!seatmap) return 0;
  return Object.values(seatmap).reduce((acc, config) => {
    const range = config.row || config.number || [0, 0];
    const letters = config.letter?.length || 0;
    return acc + (range[1] - range[0] + 1) * letters;
  }, 0);
}

export function seatsInClass(
  seatmap: Record<string, SeatmapClassConfig> | null | undefined,
  className: string
): number {
  if (!seatmap?.[className]) return 0;
  const config = seatmap[className];
  const range = config.row || config.number || [0, 0];
  const letters = config.letter?.length || 0;
  return (range[1] - range[0] + 1) * letters;
}

export function classAvailabilityLabel(booked: number, total: number): string {
  if (total <= 0) return "N/A";
  const remaining = total - booked;
  if (remaining <= 0) return "Full";
  if (remaining <= 3) return "Few seats";
  return "Available";
}
