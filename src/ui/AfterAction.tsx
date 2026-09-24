import { useState } from 'react'

import type { GameState } from '../engine/game'
import { afterActionReport, describeDealtBy, reportMarkdown } from '../engine/report'

/**
 * The after-action report, on screen (4.12).
 *
 * A table a side: each hull with what it fired, what it put through, what it
 * took and what it finished, and the side's totals above it. The same report
 * copies to the clipboard or downloads as Markdown, because the first thing a
 * player does with a result is tell the others.
 */
export function AfterAction({ game, title }: { game: GameState; title: string }) {
  const report = afterActionReport(game)
  const [copied, setCopied] = useState(false)
  const text = () => reportMarkdown(report, title)
  return (
    <div className="after-action">
      {report.sides.map((side) => (
        <section key={side.side}>
          <div className="panel-row">
            <b style={{ color: `var(--side-${side.side})` }}>{side.name}</b>
            <span className="spacer" />
            <span className="rule-detail num">
              {side.shots} shots · {side.dealt} dealt · {side.taken} taken · {side.kills} kills ·{' '}
              {side.lost} lost
            </span>
          </div>
          <table className="cost-table report-table">
            <thead>
              <tr>
                <th>Ship</th>
                <th>State</th>
                <th className="num">Shots</th>
                <th className="num">Dealt</th>
                <th className="num">Taken</th>
                <th className="num">Kills</th>
              </tr>
            </thead>
            <tbody>
              {side.ships.map((ship) => (
                <tr key={ship.id} className={`is-${ship.level}`}>
                  <td>
                    {ship.name} <span className="rule-ref">{ship.className}</span>
                  </td>
                  <td className="report-state">
                    <span className={`loss is-${ship.level}`}>{ship.level}</span>
                  </td>
                  <td className="num">{ship.shots}</td>
                  <td className="num" title={describeDealtBy(ship.dealtBy) || undefined}>
                    {ship.dealt}
                  </td>
                  <td className="num">{ship.taken}</td>
                  <td className="num">{ship.kills}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {side.otherCauses > 0 ? (
            <p className="rule-detail">
              {side.otherCauses} of the damage taken came from no enemy hull: collisions, terrain,
              a reactor going up.
            </p>
          ) : null}
        </section>
      ))}
      <div className="panel-row" style={{ background: 'none', padding: 0 }}>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text())
              setCopied(true)
            } catch {
              // No clipboard here; the download is the other way out.
            }
          }}
        >
          {copied ? 'Copied' : 'Copy as text'}
        </button>
        <button onClick={() => downloadText(`${slug(title)}.md`, text())}>Download .md</button>
      </div>
    </div>
  )
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'after-action-report'
  )
}
