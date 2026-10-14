import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailsPets } from '../components/checkout/DetailsPets';
import { CONCIERGE_COPY } from '../copy';
import type { ConciergePetNeed } from '../types';
import { predictReviewReasons } from '../utils/reviewReasons';
import type { DetailsPetDraft } from '../utils/validateDetails';

const dog: ConciergePetNeed = {
  species: 'dog',
  size: 'small',
  needsMedication: false,
  firstTimeBoarding: true,
};
const newPet: DetailsPetDraft = { existingPetId: null, name: 'Biscuit', breed: '' };

describe('which stays the page says our manager checks first', () => {
  it('matches the server: a pet without medication is confirmed at once, even a first stay', () => {
    expect(predictReviewReasons(dog)).toEqual([]);
    expect(predictReviewReasons(undefined)).toEqual([]);
  });

  it('sends a pet that takes medication to our manager', () => {
    expect(predictReviewReasons({ ...dog, needsMedication: true })).toEqual(['medication']);
  });
});

const renderPets = (petNeed: ConciergePetNeed): void => {
  render(
    <DetailsPets
      copy={CONCIERGE_COPY.en}
      petNeeds={[petNeed]}
      pets={[newPet]}
      visibleError={() => null}
      touch={() => (): void => undefined}
      onChange={() => undefined}
    />,
  );
};

describe('the review line on the details step', () => {
  it('tells the guest before sending that a pet on medication waits for our manager', () => {
    renderPets({ ...dog, needsMedication: true });

    expect(
      screen.getByText(
        'Our manager checks this stay before confirming it (takes medication). The answer appears in My stays.',
      ),
    ).toBeInTheDocument();
  });

  it('asks nothing extra and says nothing for a pet without medication', () => {
    renderPets(dog);

    expect(screen.queryByText(/Our manager checks this stay/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
