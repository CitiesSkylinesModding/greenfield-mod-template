import {
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes
} from 'react';
import { getModuleExport, isRenderable } from '../../../../utils';

/**
 * How a vanilla component hands a parent the handle on its root DOM element: the wrapper publishes
 * it, so that a parent gets the child subtree's root element without a ref the child would have to
 * forward.
 *
 * A host element as its child is served automatically.
 * A component has to claim the game's `DOMNodeContext` itself, through a stub to add on demand with
 * `getModuleExport`, and apply its `ref`, class and style to the element it renders: one that
 * ignores it leaves the parent measuring nothing, which is how an anchored popup ends up
 * positionless and hidden.
 */
export const DOMNodeModifier = getModuleExport<DOMNodeModifierComponent>(
  'game-ui/common/dom-node/dom-node.tsx',
  'DOMNodeModifier',
  (value): value is DOMNodeModifierComponent => isRenderable(value),
  // The fallback drops the ref, since with the vanilla module gone there is no handle to hand back.
  forwardRef(({ children }: DOMNodeModifierProps, _ref) => children)
);

interface DOMNodeModifierProps {
  readonly children: ReactElement;
}

type DOMNodeModifierComponent = ForwardRefExoticComponent<
  DOMNodeModifierProps & RefAttributes<HTMLElement>
>;
