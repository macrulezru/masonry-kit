export interface MasonryItemDescriptor {
  id: string
  el?: HTMLElement | (() => HTMLElement | null)
  colSpan?: number
  rowSpan?: number
  aspectRatio?: number
  estimatedSize?: number
  order?: number
}

export type LaneBreakpoints = { default: number; [maxCrossSize: number]: number }

export type LaneSpec = number | 'auto' | LaneBreakpoints

export interface MasonryOptions {
  direction?: 'vertical' | 'horizontal'
  columns?: LaneSpec
  rows?: LaneSpec
  minLaneSize?: number
  gap?: number | { main?: number; cross?: number }
  placement?: 'balanced' | 'ordered'
  virtualize?: boolean | { overscan?: number }
  scrollContainer?: HTMLElement | 'self' | 'window'
  estimateSize?: (item: MasonryItemDescriptor) => number
  animate?: boolean
  transitionDuration?: number
  transitionEasing?: string
  ssrColumns?: number
}

export interface MasonryItemLayout {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface MasonryEngineEventMap {
  layout: { items: MasonryItemLayout[]; visibleIds: string[] }
}
