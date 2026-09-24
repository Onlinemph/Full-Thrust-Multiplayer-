import { useEffect, useState } from 'react'

import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { Starfield } from './Starfield'

/**
 * The front of the house.
 *
 * The app used to open straight onto a battle, which is fine for the person
 * who built it and bewildering for anyone else: no way to tell whether the
 * ships on the table are theirs, a saved game, or the default. A menu says
 * what there is to do and whether a battle is waiting. Nothing here touches
 * the game; every button hands off to something that already existed.
 */
export interface MainMenuProps {
  /** A battle is under way and can be picked back up. */
  continueLabel: string | null
  onContinue: () => void
  onNewBattle: () => void
  onRemotePlay: () => void
  onLibrary: () => void
  onShipyard: () => void
  onLoadFile: (text: string) => void
  /** A campaign is under way and can be picked back up. */
  campaignLabel: string | null
  onContinueCampaign: () => void
  onNewCampaign: () => void
  /** Dirtside II's vehicle designer. */
  onMotorPool: () => void
  /** A Dirtside battle under way, or null. */
  dirtsideLabel: string | null
  /** The Dirtside table: continue the battle, or set up a skirmish. */
  onDirtside: () => void
  /** Rules presets: what a table allows and plays under. */
  onHouseRules: () => void
}

const MENU_TABLE = { width: 160, height: 100 }

export function MainMenu({
  continueLabel,
  onContinue,
  onNewBattle,
  onRemotePlay,
  onLibrary,
  onShipyard,
  onLoadFile,
  campaignLabel,
  onContinueCampaign,
  onNewCampaign,
  onMotorPool,
  dirtsideLabel,
  onDirtside,
  onHouseRules,
}: MainMenuProps) {
  const [size, setSize] = useState({ width: 1280, height: 800 })
  useEffect(() => {
    const read = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  const scale = Math.max(size.width / MENU_TABLE.width, size.height / MENU_TABLE.height)

  return (
    <div className="menu">
      <svg className="menu-sky" width={size.width} height={size.height} aria-hidden="true">
        <Starfield
          seed={0x46545043}
          table={MENU_TABLE}
          scale={scale}
          originX={(size.width - MENU_TABLE.width * scale) / 2}
          originY={(size.height - MENU_TABLE.height * scale) / 2}
        />
      </svg>

      <div className="menu-card">
        <p className="menu-kicker">Project Continuum</p>
        <h1 className="menu-title">Full Thrust</h1>
        <p className="menu-sub">
          Fleet actions in deep space, fought by the book: written orders, a fifteen-phase turn,
          threshold checks and all. Hot-seat on one screen or two browsers over a code, or a
          campaign across a star map with battles fought at the table.
        </p>

        <div className="menu-actions">
          {continueLabel ? (
            <button className="primary" onClick={onContinue}>
              Continue <span className="menu-hint">{continueLabel}</span>
            </button>
          ) : null}
          <button className={continueLabel ? undefined : 'primary'} onClick={onNewBattle}>
            New battle
          </button>

          <div className="menu-group">
            <h4>Play</h4>
            <div className="menu-group-grid">
              <button onClick={onRemotePlay}>Remote play</button>
              {campaignLabel ? (
                <button onClick={onContinueCampaign}>
                  Continue campaign <span className="menu-hint">{campaignLabel}</span>
                </button>
              ) : null}
              <button onClick={onNewCampaign}>{campaignLabel ? 'New campaign' : 'Campaign'}</button>
              <button onClick={onDirtside}>
                {dirtsideLabel ? 'Continue the ground battle' : 'Dirtside table'}{' '}
                <span className="menu-hint">{dirtsideLabel ?? 'Dirtside II skirmish'}</span>
              </button>
            </div>
          </div>

          <div className="menu-group">
            <h4>Design</h4>
            <div className="menu-group-grid">
              <button onClick={onMotorPool}>
                Motor Pool <span className="menu-hint">Dirtside II vehicle designer</span>
              </button>
              <button onClick={onLibrary}>Ship library</button>
              <button onClick={onShipyard}>Shipyard</button>
            </div>
          </div>

          <div className="menu-group">
            <h4>Reference</h4>
            <div className="menu-group-grid">
              <button onClick={onHouseRules}>
                House rules <span className="menu-hint">presets of gear and rules</span>
              </button>
              <label className="file-button menu-file">
                Load a battle file
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    onLoadFile(await file.text())
                    event.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <p className="menu-foot">
          Full Thrust: Project Continuum v1.1.4 · rules reading {CURRENT_RULES_VERSION} · no
          server, no account; battles live in this browser and in the files you save.
        </p>
      </div>
    </div>
  )
}
