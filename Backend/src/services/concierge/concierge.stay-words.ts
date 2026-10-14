/**
 * Both model prompts use the parent's own words for the two ends of a stay. Wagstay does not
 * collect or deliver pets, so "pick-up" would promise a service that does not exist.
 */
export const STAY_WORDS_PROMPT_RULE =
  '- Say check-in and check-out (in Chinese 入住 and 离店), never drop-off or pick-up: the parent brings the pet in and takes it home, Wagstay does not collect or deliver pets.';
