import { useValue } from 'cs2/api';
import { bindInputAction } from './input-action';
import { lazyBindValue } from './lazy-value-binding';

const GROUP = 'greenfield.entityCounter';

/**
 * Serialization of C# `Greenfield.Systems.EntityCounterUISystem.EntityCount`.
 */
export interface EntityCount {
  readonly count: number;
  readonly year: number;
  // Zero-based, as the vanilla `LocalizedDate` reads it.
  readonly month: number;
}

const entityCount$ = lazyBindValue<EntityCount>(GROUP, 'entityCount', {
  count: 0,
  year: 0,
  month: 0
});

/**
 * Subscribes to the entity count and the simulation date, which C# updates every frame of a game.
 */
export function useEntityCount(): EntityCount {
  return useValue(entityCount$());
}

/**
 * The key binding toggling the entity counter panel, enabled while a component subscribes to it.
 */
export const entityCounterToggleInputAction = bindInputAction(GROUP, 'toggleInputAction');
