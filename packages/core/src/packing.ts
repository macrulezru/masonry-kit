export interface PackInput {
  id: string
  /** Number of adjacent lanes this item occupies — clamped to `[1, lanes]` internally, so callers don't need to pre-clamp. */
  span: number
  /** Size along the main (unbounded, growing) axis — a real measurement or a provisional estimate. */
  mainSize: number
}

export interface PackedItem {
  id: string
  /** Index of the first lane this item occupies. */
  laneIndex: number
  span: number
  /** Position along the main axis. */
  mainPos: number
}

export interface PackResult {
  items: PackedItem[]
  /** Size the container needs along the main axis to fit every packed item, with no trailing gap past the last one. */
  totalMainSize: number
}

/**
 * Skyline-packing generalized to spans (tech spec §3.2/§3.3): for span 1 this
 * is the classic "shortest lane wins" algorithm; a wider span is the same
 * search over every valid starting lane, minimizing the tallest edge among
 * the lanes it would cover, and then raises all of them to the new edge.
 * `'ordered'` skips the search and assigns lanes by strict round-robin instead.
 */
export function packLanes(
  items: readonly PackInput[],
  lanes: number,
  gapMain: number,
  placement: 'balanced' | 'ordered' = 'balanced',
): PackResult {
  const laneCount = Math.max(1, Math.floor(lanes) || 1)
  const laneEdges = new Array<number>(laneCount).fill(0)
  const packed: PackedItem[] = []
  let roundRobinCursor = 0

  for (const item of items) {
    const span = Math.min(Math.max(1, Math.floor(item.span) || 1), laneCount)

    let laneIndex: number
    if (placement === 'ordered') {
      laneIndex = roundRobinCursor + span <= laneCount ? roundRobinCursor : 0
      roundRobinCursor = laneIndex + span
      if (roundRobinCursor >= laneCount) roundRobinCursor = 0
    } else {
      let bestLane = 0
      let bestEdge = Infinity
      for (let start = 0; start <= laneCount - span; start++) {
        let edge = 0
        for (let k = start; k < start + span; k++) edge = Math.max(edge, laneEdges[k])
        if (edge < bestEdge) {
          bestEdge = edge
          bestLane = start
        }
      }
      laneIndex = bestLane
    }

    let mainPos = 0
    for (let k = laneIndex; k < laneIndex + span; k++) mainPos = Math.max(mainPos, laneEdges[k])

    packed.push({ id: item.id, laneIndex, span, mainPos })

    const newEdge = mainPos + item.mainSize + gapMain
    for (let k = laneIndex; k < laneIndex + span; k++) laneEdges[k] = newEdge
  }

  const totalMainSize = packed.length ? Math.max(0, Math.max(...laneEdges) - gapMain) : 0
  return { items: packed, totalMainSize }
}
