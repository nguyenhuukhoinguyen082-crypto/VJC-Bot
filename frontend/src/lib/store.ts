// Bamboo Airways — Zustand Store
import { create } from "zustand";
import type { User } from "./types";

interface AuthState {
  user: (User & { user_id: string }) | null;
  isLoading: boolean;
  setUser: (user: (User & { user_id: string }) | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isLoading: false }),
}));

interface BookingState {
  step: number;
  selectedFlightId: string | null;
  selectedClass: string | null;
  selectedSeat: string | null;
  passengerName: string;
  passengerRobloxUsername: string;
  passengerDiscordId: string;
  passengerNationality: string;
  passengerSpecialRequests: string;
  setStep: (step: number) => void;
  setSelectedFlight: (flightId: string, seatClass: string) => void;
  setSelectedSeat: (seat: string) => void;
  setPassengerInfo: (info: Partial<BookingState>) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  step: 1,
  selectedFlightId: null,
  selectedClass: null,
  selectedSeat: null,
  passengerName: "",
  passengerRobloxUsername: "",
  passengerDiscordId: "",
  passengerNationality: "",
  passengerSpecialRequests: "",
  setStep: (step) => set({ step }),
  setSelectedFlight: (flightId, seatClass) =>
    set({ selectedFlightId: flightId, selectedClass: seatClass }),
  setSelectedSeat: (seat) => set({ selectedSeat: seat }),
  setPassengerInfo: (info) => set(info),
  reset: () =>
    set({
      step: 1,
      selectedFlightId: null,
      selectedClass: null,
      selectedSeat: null,
      passengerName: "",
      passengerRobloxUsername: "",
      passengerDiscordId: "",
      passengerNationality: "",
      passengerSpecialRequests: "",
    }),
}));
