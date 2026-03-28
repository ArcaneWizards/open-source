export type ControlPosition =
  | 'row'
  | 'label'
  | 'first'
  | 'second'
  | 'both'
  | 'all'
  | 'extra';

export const clsControlPosition = (position?: ControlPosition) => {
  if (!position) return undefined;
  switch (position) {
    case 'row':
      return 'control-grid-pos-row';
    case 'label':
      return 'control-grid-pos-label';
    case 'first':
      return 'control-grid-pos-first';
    case 'second':
      return 'control-grid-pos-second';
    case 'both':
      return 'control-grid-pos-both';
    case 'all':
      return 'control-grid-pos-all';
    case 'extra':
      return 'control-grid-pos-extra';
  }
};

export const clsControlSubgridPosition = (
  position: ControlPosition,
  subgrid?: boolean,
) => {
  if (!subgrid) return undefined;
  switch (position) {
    case 'label':
      return 'col-[1/span_1]';
    case 'first':
      return 'col-[2/span_1]';
    case 'second':
      return 'col-[3/span_1]';
  }
};

export const controlPositionClass = clsControlPosition;
