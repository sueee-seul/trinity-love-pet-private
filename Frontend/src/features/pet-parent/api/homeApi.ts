// GET /api/petparent/home -> HomeData (state, pets, active bookings)
import type { HomeData } from '../types/home';
import { request } from './bookingApi';

export function fetchHome(): Promise<HomeData> {
  return request<HomeData>('/petparent/home');
}
