import React, { useId } from 'react';
import { ConciergeIllustration as Illustration } from '../ConciergeIllustration';
import type { ConciergeCopy } from '../../copy';
import type {
  ConciergeCatalogue,
  ConciergeCatalogueItem,
  ConciergeLocale,
  ConciergePetNeed,
  ConciergePetSelection,
} from '../../types';
import { formatNzd, priceUnitLabel } from '../../utils/format';
import { serviceNameText } from '../../utils/serviceNames';
import { addonsFor, isLockedAddon } from '../../utils/staySelection';
import { CHECKBOX, CHECK_ROW, FIELD_LABEL } from '../conciergeStyles';

interface StayBuilderProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  catalogue: ConciergeCatalogue;
  pets: ConciergePetNeed[];
  selection: ConciergePetSelection[];
  /** Paused while the assistant replies, so a tick never races the details it is reading. */
  disabled: boolean;
  onRoom: (petIndex: number, roomId: string) => void;
  onFood: (petIndex: number, foodId: string) => void;
  onAddon: (petIndex: number, addonId: string) => void;
}

/** A service's name, price and unit on one row, with its description under it when there is one. */
const ItemText: React.FC<{
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  item: ConciergeCatalogueItem;
}> = ({ copy, locale, item }) => (
  <span className="min-w-0 flex-1">
    <span className="flex items-baseline justify-between gap-3">
      <span className="[overflow-wrap:anywhere]">{serviceNameText(item.name, locale)}</span>
      <span className="flex-shrink-0 type-meta tabular-nums text-notice-secondary">
        {formatNzd(item.unitPrice)} {priceUnitLabel(copy, item.priceUnit)}
      </span>
    </span>
    {item.description && (
      <span className="block type-meta text-notice-muted">{item.description}</span>
    )}
  </span>
);

/** One room or one food per pet: a radio group, each option on its own 44px row. */
const OneOf: React.FC<{
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  legend: string;
  name: string;
  items: ConciergeCatalogueItem[];
  value: string;
  onChange: (id: string) => void;
}> = ({ copy, locale, legend, name, items, value, onChange }) => (
  <fieldset className="m-0 min-w-0 border-0 p-0">
    <legend className={FIELD_LABEL}>{legend}</legend>
    <div className="flex flex-col">
      {items.map((item) => (
        <label key={item.id} className={CHECK_ROW}>
          <input
            type="radio"
            name={name}
            value={item.id}
            checked={value === item.id}
            onChange={() => onChange(item.id)}
            className={CHECKBOX}
          />
          <ItemText copy={copy} locale={locale} item={item} />
        </label>
      ))}
    </div>
  </fieldset>
);

const PetChoices: React.FC<{
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  catalogue: ConciergeCatalogue;
  pet: ConciergePetNeed;
  index: number;
  choice: ConciergePetSelection;
  onRoom: (roomId: string) => void;
  onFood: (foodId: string) => void;
  onAddon: (addonId: string) => void;
}> = ({ copy, locale, catalogue, pet, index, choice, onRoom, onFood, onAddon }) => {
  const groupName = useId();
  const addons = addonsFor(catalogue.addons, pet);
  const species = pet.species ? copy.checklist[pet.species] : null;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-2xl border border-border-soft p-4">
      <legend className="px-1 type-body font-semibold text-notice-primary">
        {pet.name ?? copy.checklist.petLabel(index)}
        {species ? ` · ${species}` : ''}
      </legend>
      <OneOf
        copy={copy}
        locale={locale}
        legend={copy.packages.room}
        name={`${groupName}-room`}
        items={catalogue.rooms}
        value={choice.roomId}
        onChange={onRoom}
      />
      <OneOf
        copy={copy}
        locale={locale}
        legend={copy.packages.food}
        name={`${groupName}-food`}
        items={catalogue.foods}
        value={choice.foodId}
        onChange={onFood}
      />
      {addons.length > 0 && (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={FIELD_LABEL}>{copy.packages.addons}</legend>
          {addons.some((addon) => /grooming|bath/i.test(addon.name)) && (
            <Illustration
              name="grooming"
              className="mb-3"
              imageClassName="h-24 w-full rounded-xl object-cover"
            />
          )}
          <div className="flex flex-col">
            {addons.map((addon) => {
              const locked = isLockedAddon(addon, pet);
              const lockNote = !locked
                ? null
                : addon.compulsory
                  ? copy.packages.alwaysIncluded
                  : copy.packages.medicationIncluded;
              return (
                <label key={addon.id} className={`${CHECK_ROW} has-[:disabled]:cursor-default`}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={locked || choice.addonIds.includes(addon.id)}
                    disabled={locked}
                    // The server always adds these, so the tick is a statement, not a choice.
                    aria-describedby={lockNote ? `${groupName}-${addon.id}-why` : undefined}
                    onChange={() => onAddon(addon.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <ItemText copy={copy} locale={locale} item={addon} />
                    {lockNote && (
                      <span
                        id={`${groupName}-${addon.id}-why`}
                        className="block type-meta text-notice-muted"
                      >
                        {lockNote}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
};

/**
 * Every bookable service, pet by pet, as the choice it is: one room, one food, any add-ons. A
 * change goes to the server for its price a moment later; the panel never adds anything up.
 */
export const StayBuilder: React.FC<StayBuilderProps> = ({
  copy,
  locale,
  catalogue,
  pets,
  selection,
  disabled,
  onRoom,
  onFood,
  onAddon,
}) => (
  <fieldset
    disabled={disabled}
    className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:opacity-70"
  >
    <legend className="sr-only">{copy.packages.buildTitle}</legend>
    {pets.map((pet, index) => {
      const choice = selection[index];
      if (!choice) return null;
      return (
        <PetChoices
          // Pets have no id before checkout; position is their identity.
          // eslint-disable-next-line react/no-array-index-key -- position is the pet's identity until checkout.
          key={`pet-${index}`}
          copy={copy}
          locale={locale}
          catalogue={catalogue}
          pet={pet}
          index={index}
          choice={choice}
          onRoom={(roomId) => onRoom(index, roomId)}
          onFood={(foodId) => onFood(index, foodId)}
          onAddon={(addonId) => onAddon(index, addonId)}
        />
      );
    })}
  </fieldset>
);
