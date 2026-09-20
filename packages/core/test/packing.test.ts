import { describe, expect, it } from 'vitest'
import { packLanes } from '../src/packing'

describe('packLanes — balanced (skyline)', () => {
  it('places each item in the currently shortest lane', () => {
    const { items } = packLanes(
      [
        { id: 'a', span: 1, mainSize: 100 },
        { id: 'b', span: 1, mainSize: 50 },
        { id: 'c', span: 1, mainSize: 10 },
      ],
      2,
      10,
    )
    expect(items.find((i) => i.id === 'a')).toMatchObject({ laneIndex: 0, mainPos: 0 })
    expect(items.find((i) => i.id === 'b')).toMatchObject({ laneIndex: 1, mainPos: 0 })
    // lane 0 edge after a = 100+10=110, lane 1 edge after b = 50+10=60 -> c goes to the shorter lane 1
    expect(items.find((i) => i.id === 'c')).toMatchObject({ laneIndex: 1, mainPos: 60 })
  })

  it('computes the total main size from the tallest lane, with no trailing gap', () => {
    const { totalMainSize } = packLanes([{ id: 'a', span: 1, mainSize: 100 }], 1, 10)
    expect(totalMainSize).toBe(100)
  })

  it('returns zero size for an empty input', () => {
    expect(packLanes([], 3, 10).totalMainSize).toBe(0)
  })
})

describe('packLanes — span (bento)', () => {
  it('places a spanning item at the max edge of the lanes it covers, and raises all of them to the new edge', () => {
    const { items, totalMainSize } = packLanes(
      [
        { id: 'a', span: 1, mainSize: 100 }, // lane 0 -> edge 110
        { id: 'b', span: 1, mainSize: 20 }, // lane 1 -> edge 30
        { id: 'c', span: 2, mainSize: 50 }, // spans lanes 0-1, must start at max(110, 30) = 110
      ],
      2,
      10,
    )
    expect(items.find((i) => i.id === 'c')).toMatchObject({ laneIndex: 0, mainPos: 110, span: 2 })
    expect(totalMainSize).toBe(110 + 50)
  })

  it('picks the starting lane that minimizes the covered lanes tallest edge', () => {
    const { items } = packLanes(
      [
        { id: 'a', span: 1, mainSize: 100 }, // lane 0 -> edge 110
        { id: 'b', span: 1, mainSize: 10 }, // lane 1 -> edge 20
        { id: 'c', span: 1, mainSize: 10 }, // lane 2 -> edge 20
        { id: 'd', span: 2, mainSize: 5 }, // covers (0,1)=110 or (1,2)=20 -> picks (1,2)
      ],
      3,
      10,
    )
    expect(items.find((i) => i.id === 'd')).toMatchObject({ laneIndex: 1, mainPos: 20 })
  })

  it('clamps a span wider than the lane count', () => {
    const { items } = packLanes([{ id: 'a', span: 5, mainSize: 20 }], 2, 10)
    expect(items[0].span).toBe(2)
  })
})

describe('packLanes — ordered', () => {
  it('assigns lanes by strict round-robin regardless of current lane heights', () => {
    const { items } = packLanes(
      [
        { id: 'a', span: 1, mainSize: 100 },
        { id: 'b', span: 1, mainSize: 10 },
        { id: 'c', span: 1, mainSize: 10 },
      ],
      2,
      10,
      'ordered',
    )
    expect(items.map((i) => i.laneIndex)).toEqual([0, 1, 0])
  })

  it('wraps a spanning item back to lane 0 instead of overflowing the lane count', () => {
    const { items } = packLanes(
      [
        { id: 'a', span: 1, mainSize: 10 }, // lane 0
        { id: 'b', span: 2, mainSize: 10 }, // would overflow at lane 1 (1+2>2) -> wraps to lane 0
      ],
      2,
      10,
      'ordered',
    )
    expect(items.find((i) => i.id === 'b')).toMatchObject({ laneIndex: 0 })
  })
})
