import { apiGet, apiPost } from "./client";

export type Slot = { start_utc: string; end_utc: string };

export async function fetchSlots(args: {
  Authorization: string;
  from_utc: string;
  to_utc: string;
}): Promise<Slot[]> {
  const res = await apiGet<{ slots: Slot[] }>("/api/v1/calendly", {
    Authorization: args.Authorization,
    from_utc: args.from_utc,
    to_utc: args.to_utc,
  });
  return res.slots ?? [];
}

export type BookingRequest = {
  Authorization: string;
  start_utc: string;
  telegram: string;
  invitee: { email: string; name: string };
};

export type BookingResponse = {
  created_at?: string;
  event_url?: string;
  payment_url?: string;
  [k: string]: any;
};

export async function createBooking(
  req: BookingRequest
): Promise<BookingResponse> {
  return apiPost<BookingResponse>("/api/v1/calendly", {
    Authorization: req.Authorization,
    invitee: req.invitee,
    start_utc: req.start_utc,
    telegram: req.telegram,
  });
}
