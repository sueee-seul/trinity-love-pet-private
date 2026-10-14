import { useEffect, useState } from 'react';
import { readProfileState, subscribeProfileState } from './repository';
import type { ParentProfileState } from './types';

/** `null` until the server has answered. There is no fixture to fall back to. */
export function useProfileState(): ParentProfileState | null {
  const [state, setState] = useState<ParentProfileState | null>(() => readProfileState());

  useEffect(() => subscribeProfileState(() => setState(readProfileState())), []);

  return state;
}
