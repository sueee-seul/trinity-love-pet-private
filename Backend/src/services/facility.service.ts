import { AppError } from '../common/middlewares/error.middleware.js';
import * as repository from '../repositories/facility.repository.js';
import {
  FACILITY_SIZES,
  type Facility,
  type FacilityEditableFields,
  type FacilitySize,
} from '../contracts/facility.contract.js';

const notFound = (): AppError => new AppError('Facility not found', 'NOT_FOUND', 404);

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${field} is required`, 'VALIDATION_ERROR', 400);
  }
  return value.trim();
};

const optionalText = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be text`, 'VALIDATION_ERROR', 400);
  }
  return value.trim() || null;
};

/**
 * Capacity is the number a manager types into a box, so it is validated as a
 * whole non-negative integer rather than trusted. A stray decimal or a negative
 * would otherwise be written straight through the schema's `capacity >= 0`
 * check and produce a confusing database error instead of a readable one.
 */
const parseCapacity = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError('Capacity must be a whole number of 0 or more', 'VALIDATION_ERROR', 400);
  }
  return parsed;
};

const parseSize = (value: unknown): FacilitySize => {
  if (!FACILITY_SIZES.some((candidate) => candidate === value)) {
    throw new AppError(`Size must be one of ${FACILITY_SIZES.join(', ')}`, 'VALIDATION_ERROR', 400);
  }
  return value as FacilitySize;
};

const parseEmail = (value: unknown): string | null => {
  const email = optionalText(value, 'Email');
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Email must be a valid address', 'VALIDATION_ERROR', 400);
  }
  return email ? email.toLowerCase() : null;
};

/**
 * The whole record is validated every time. The settings form submits every
 * field, and accepting a partial body would blank whichever fields the caller
 * happened to leave out.
 */
const parseFacility = (input: unknown): FacilityEditableFields => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new AppError('Facility details are required', 'VALIDATION_ERROR', 400);
  }
  const body = input as Record<string, unknown>;

  return {
    name: requireText(body.name, 'Facility name'),
    suburb: optionalText(body.suburb, 'Suburb'),
    city: optionalText(body.city, 'City'),
    size: parseSize(body.size),
    capacity: parseCapacity(body.capacity),
    address: requireText(body.address, 'Address'),
    phone: optionalText(body.phone, 'Phone'),
    email: parseEmail(body.email),
    about: optionalText(body.about, 'About'),
  };
};

export const getList = async (): Promise<Facility[]> => {
  return repository.listFacilities();
};

export const getDetail = async (id: string): Promise<Facility> => {
  const facility = await repository.findFacilityById(id);
  if (!facility) {
    throw notFound();
  }
  return facility;
};

export const update = async (id: string, input: unknown): Promise<Facility> => {
  const changes = parseFacility(input);

  const facility = await repository.updateFacility(id, changes);
  if (!facility) {
    throw notFound();
  }
  return facility;
};
