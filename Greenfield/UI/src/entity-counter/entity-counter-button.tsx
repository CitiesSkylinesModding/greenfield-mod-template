import { Button } from 'cs2/ui';
import type { ReactElement } from 'react';
import { Tooltip } from '../components/tooltip';
import { useTranslate } from '../utils';
import { TooltipLayout } from '../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import { useIsEntityCounterPanelOpen } from './use-entity-counter-panel';
import * as styles from './entity-counter-button.module.scss';

/**
 * The entity counter's button in the game's mods menu, opening and closing its panel.
 */
export function EntityCounterButton(): ReactElement {
  const translate = useTranslate();

  const [isOpen, setIsOpen] = useIsEntityCounterPanelOpen();

  return (
    <Tooltip
      direction='left'
      tooltip={
        <TooltipLayout
          title={translate('Greenfield.EntityCounter.TITLE')}
          description={translate('Greenfield.EntityCounter.DESCRIPTION')}
        />
      }>
      <Button
        variant='floating'
        className={styles.entityCounterButton}
        src='Media/Game/Icons/CityStatistics.svg'
        selected={isOpen}
        onSelect={() => setIsOpen(open => !open)}
      />
    </Tooltip>
  );
}
