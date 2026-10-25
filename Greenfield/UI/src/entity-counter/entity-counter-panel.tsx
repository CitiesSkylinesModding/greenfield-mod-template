import { LocalizedDate, LocalizedNumber } from 'cs2/l10n';
import { Panel, PanelSection, PanelSectionRow } from 'cs2/ui';
import { type ReactElement, useEffect } from 'react';
import { useTranslate } from '../utils';
import * as bindings from '../utils/bindings';
import { useIsEntityCounterPanelOpen } from './use-entity-counter-panel';
import * as styles from './entity-counter-panel.module.scss';

/**
 * The entity counter panel: the count of what the settings select, and the simulation date.
 * Always mounted in a game, so that its key binding works while it is closed.
 */
export function EntityCounterPanel(): ReactElement | null {
  const [isOpen, setIsOpen] = useIsEntityCounterPanelOpen();

  const togglePhase = bindings.entityCounterToggleInputAction.useInputPhase();

  useEffect(() => {
    if (togglePhase == 'Performed') {
      setIsOpen(open => !open);
    }
  }, [togglePhase, setIsOpen]);

  return isOpen ? <EntityCounterPanelContent onClose={() => setIsOpen(false)} /> : null;
}

function EntityCounterPanelContent({ onClose }: { readonly onClose: () => void }): ReactElement {
  const translate = useTranslate();

  const { countedEntity } = bindings.useModSettings();

  const { count, year, month } = bindings.useEntityCount();

  return (
    <Panel
      draggable={true}
      initialPosition={{ x: 0.85, y: 0.3 }}
      className={styles.entityCounter}
      header={translate('Greenfield.EntityCounter.TITLE')}
      onClose={onClose}>
      <PanelSection>
        <PanelSectionRow
          left={translate(`Greenfield.EntityCounter.COUNTED[${countedEntity}]`)}
          right={<LocalizedNumber value={count} />}
        />

        <PanelSectionRow
          left={translate('Greenfield.EntityCounter.DATE')}
          right={<LocalizedDate value={{ year, month }} />}
        />
      </PanelSection>
    </Panel>
  );
}
