import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { resetBindings, setBinding, setTranslations } from '../testing/game-setup';
import { EntityCounterButton } from './entity-counter-button';
import { EntityCounterPanel } from './entity-counter-panel';
import { useIsEntityCounterPanelOpen } from './use-entity-counter-panel';

const GROUP = 'greenfield.entityCounter';

beforeEach(() => {
  setTranslations({ 'Greenfield.EntityCounter.TITLE': 'Entity Counter' });
});

afterEach(() => {
  // The panel's visibility is shared at module level, so it outlives a test's render.
  const { result } = renderHook(useIsEntityCounterPanelOpen);

  act(() => result.current[1](false));

  cleanup();
  resetBindings();
});

// Both are mounted for the whole game, in two trees of the game's UI.
function EntityCounter(): ReactElement {
  return (
    <>
      <EntityCounterButton />
      <EntityCounterPanel />
    </>
  );
}

function button(): HTMLElement {
  return screen.getByRole('button');
}

function isPanelOpen(): boolean {
  return screen.queryByText('Entity Counter') != null;
}

function pressToggleKey(): void {
  // The key goes down then up, which the input action reports as two phases.
  act(() => setBinding(GROUP, 'toggleInputAction.phase', 'Performed'));
  act(() => setBinding(GROUP, 'toggleInputAction.phase', 'Canceled'));
}

describe('the entity counter', () => {
  it(`opens and closes from its mods menu button`, () => {
    render(<EntityCounter />);

    expect(isPanelOpen()).toBe(false);

    fireEvent.click(button());

    expect(isPanelOpen()).toBe(true);
    expect(button().classList.contains('selected')).toBe(true);

    fireEvent.click(button());

    expect(isPanelOpen()).toBe(false);
  });

  it(`opens and closes with its key binding`, () => {
    render(<EntityCounter />);

    pressToggleKey();

    expect(isPanelOpen()).toBe(true);

    pressToggleKey();

    expect(isPanelOpen()).toBe(false);
  });

  it(`shows the count of what the settings select, and the simulation date`, () => {
    setTranslations({
      'Greenfield.EntityCounter.COUNTED[citizens]': 'Citizens',
      'Common.THOUSANDS_SEPARATOR': ',',
      'Common.MEDIUM_DATE_FORMAT': '{MONTH} {YEAR}',
      'Common.MONTH_SHORT:4': 'May'
    });

    setBinding('greenfield.common', 'settings', { countedEntity: 'citizens' });
    setBinding(GROUP, 'entityCount', { count: 1234, year: 2025, month: 4 });

    render(<EntityCounter />);

    fireEvent.click(button());

    expect(screen.getByText('Citizens')).toBeDefined();
    expect(screen.getByText('1,234')).toBeDefined();
    expect(screen.getByText('May 2025')).toBeDefined();
  });
});
