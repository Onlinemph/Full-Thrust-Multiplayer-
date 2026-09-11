import { useEffect, useState } from 'react'

import { currentJournal, previewAt, stopPreview } from './store'

/**
 * Scrubbing back through a battle.
 *
 * Almost free, and only because of the one architectural fact: a battle is
 * (setup + action journal), so any earlier moment is just the journal replayed
 * to a shorter length. There is no snapshot history to keep and no undo stack
 * to unwind — the dice come out the same because the seed and the sequence of
 * draws are the same.
 *
 * Scrubbing is a *preview*: it shows an earlier state without discarding
 * anything, so a player can look at how a volley went and slide back to the
 * present. Undo is the destructive one.
 */
export function ReplayBar({ onPreview }: { onPreview: (previewing: boolean) => void }) {
  const length = currentJournal().length
  const [at, setAt] = useState(length)
  const [playing, setPlaying] = useState(false)

  // Snap to the present whenever the battle grows, or the slider would sit at
  // an old position while the game moved on underneath it.
  useEffect(() => {
    setAt(length)
    setPlaying(false)
    stopPreview()
    onPreview(false)
  }, [length, onPreview])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setAt((current) => {
        const next = current + 1
        if (next >= length) {
          setPlaying(false)
          stopPreview()
          onPreview(false)
          return length
        }
        previewAt(next)
        onPreview(true)
        return next
      })
    }, 220)
    return () => clearInterval(timer)
  }, [playing, length, onPreview])

  if (length === 0) return null

  const scrub = (value: number) => {
    setAt(value)
    setPlaying(false)
    if (value >= length) {
      stopPreview()
      onPreview(false)
    } else {
      previewAt(value)
      onPreview(true)
    }
  }

  const live = at >= length

  return (
    <div className={`replay-bar${live ? '' : ' is-previewing'}`}>
      <button
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause replay' : 'Play replay'}
      >
        {playing ? '❙❙' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={length}
        value={at}
        aria-label="Replay position"
        onChange={(event) => scrub(Number(event.target.value))}
      />
      <span className="num">
        {at} / {length}
      </span>
      {live ? (
        <span className="replay-state">live</span>
      ) : (
        <button onClick={() => scrub(length)}>Back to now</button>
      )}
    </div>
  )
}
