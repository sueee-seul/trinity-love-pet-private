import { pool } from '../config/database.js';

/** What the booking told us about a new pet, in the pets table's own columns. */
export interface PetProfileFill {
  breed: string | null;
  weightKg: number | null;
  colour: string | null;
  /** `pets.gender`: true is male, false is female (as parent.profile.repository.ts reads it). */
  male: boolean | null;
  /** Only ever turns desexed on; a booking never says a pet is not desexed. */
  desexed: boolean;
  dietNotes: string | null;
  allergies: string | null;
  behaviourNotes: string | null;
  healthNotes: string | null;
  vetName: string | null;
  vetPhone: string | null;
  /** ISO YYYY-MM-DD. */
  birthDate: string | null;
}

/**
 * Fills the empty fields of a pet the booking just made, and only those: anything the parent or
 * staff already wrote stays. The owner check keeps the write to that parent's own pet.
 */
export const fillEmptyPetProfile = async (
  ownerId: string,
  petId: string,
  fill: PetProfileFill,
): Promise<void> => {
  await pool.query(
    `UPDATE pets
        SET breed = COALESCE(breed, $3),
            weight = COALESCE(weight, $4::numeric),
            colour = COALESCE(colour, $5),
            gender = COALESCE(gender, $6::boolean),
            desexed = desexed OR $7::boolean,
            diet_notes = COALESCE(diet_notes, $8),
            allergies = COALESCE(allergies, $9),
            behaviour_notes = COALESCE(behaviour_notes, $10),
            health_notes = COALESCE(health_notes, $11),
            vet_name = COALESCE(vet_name, $12),
            vet_phone = COALESCE(vet_phone, $13),
            date_of_birth = COALESCE(date_of_birth, $14::date),
            updated_at = now()
      WHERE uuid = $2::uuid AND pet_owners_uuid = $1::uuid`,
    [
      ownerId,
      petId,
      fill.breed,
      fill.weightKg,
      fill.colour,
      fill.male,
      fill.desexed,
      fill.dietNotes,
      fill.allergies,
      fill.behaviourNotes,
      fill.healthNotes,
      fill.vetName,
      fill.vetPhone,
      fill.birthDate,
    ],
  );
};
