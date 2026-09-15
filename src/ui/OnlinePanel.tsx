import { useState } from 'react'

import { acceptReply, hangUp, hostInvite, joinInvite, useNet } from './net'
import { netState } from './link'
import { createMatch, joinMatch, supabaseConfigured } from './supabaseLink'
import { currentGame, currentMatchSide, setMatchSide } from './store'

/**
 * Linking two browsers for a remote game.
 *
 * Two ways in. With a Supabase project behind the build, the host gets a
 * six-letter code and the guest types it — and the battle is kept on the
 * server, so either player can come back to it. Without one, no server and no
 * account: the host makes an invite code, the guest answers with a reply code,
 * and the two codes travel over whatever channel the players already share —
 * a chat window, a phone call, a scrap of paper. See `link.ts` for the
 * protocol both ride on.
 */
export function OnlinePanel({ onClose }: { onClose: () => void }) {
  const net = useNet()
  const game = currentGame()
  const [inviteInput, setInviteInput] = useState('')
  const [replyInput, setReplyInput] = useState('')
  const [matchInput, setMatchInput] = useState('')
  const [busy, setBusy] = useState(false)
  const side = currentMatchSide()
  const hosted = supabaseConfigured()

  const run = (work: () => Promise<void>) => {
    setBusy(true)
    void work().finally(() => {
      setBusy(false)
      // Linked: the lobby is the next thing to see, not this panel.
      if (netState().phase === 'connected') onClose()
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Remote play</h2>

        {net.phase === 'connected' || net.phase === 'connecting' ? (
          <>
            {net.transport === 'supabase' && net.code ? (
              <div className="match-code" aria-label="Match code">
                <span>Match code</span>
                <b className="num">{net.code}</b>
                <span style={{ color: 'var(--ink-dim)' }}>
                  {net.phase === 'connecting'
                    ? 'joining…'
                    : net.peers > 1
                      ? `${net.peers} consoles on the table`
                      : 'waiting for the other player'}
                </span>
              </div>
            ) : null}
            <p>
              {net.phase === 'connecting'
                ? 'Opening the channel.'
                : 'Linked. Every action now travels to the other console as it happens.'}
            </p>
            <div className="panel-row">
              <span>You command</span>
              <span className="spacer" />
              <select
                value={side ?? ''}
                onChange={(event) => setMatchSide(event.target.value || null)}
              >
                <option value="">Both fleets (hot-seat)</option>
                {game.sides.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ color: 'var(--ink-dim)' }}>
              Pick your fleet and the other console cannot give it orders, nor you theirs.
            </p>
            <button onClick={() => hangUp(null)}>Disconnect</button>
          </>
        ) : (
          <>
            <section>
              <h3>By match code</h3>
              {hosted ? (
                <>
                  <p>
                    A match opens in a lobby under a six-letter code: you settle the rules, each
                    of you picks a fleet, and the battle starts when both are ready. Tell the
                    other player the code; they join with it, and either of you can come back to
                    it later.
                  </p>
                  <button className="primary" disabled={busy} onClick={() => run(createMatch)}>
                    Create a match
                  </button>
                  <label className="code-field">
                    Or join one
                    <input
                      type="text"
                      value={matchInput}
                      placeholder="ABC234"
                      maxLength={8}
                      autoCapitalize="characters"
                      spellCheck={false}
                      onChange={(event) => setMatchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') run(() => joinMatch(matchInput))
                      }}
                    />
                  </label>
                  <div className="panel-row" style={{ background: 'none', padding: 0 }}>
                    <button disabled={busy} onClick={() => run(() => joinMatch(matchInput))}>
                      Join as the guest
                    </button>
                    <button disabled={busy} onClick={() => run(() => joinMatch(matchInput, 'host'))}>
                      Come back as the host
                    </button>
                  </div>
                </>
              ) : (
                <p>
                  Not set up for this build. Point it at a Supabase project — run{' '}
                  <code>supabase/schema.sql</code> there and build with <code>VITE_SUPABASE_URL</code>{' '}
                  and <code>VITE_SUPABASE_ANON_KEY</code> — and matches get a six-letter code and a
                  place to live between sessions. The README has the steps.
                </p>
              )}
            </section>

            <section>
              <h3>Without a server</h3>
              <button className="primary" onClick={() => void hostInvite()}>
                Create an invite code
              </button>
              {net.code && net.phase === 'inviting' ? (
                <>
                  <CodeBox label="Send them this invite code" code={net.code} />
                  <label className="code-field">
                    Then paste their reply here
                    <textarea
                      rows={3}
                      value={replyInput}
                      onChange={(event) => setReplyInput(event.target.value)}
                    />
                  </label>
                  <button onClick={() => void acceptReply(replyInput)}>Connect</button>
                </>
              ) : null}
            </section>

            <section>
              <h3>Answer an invite</h3>
              <label className="code-field">
                Paste the invite code you were sent
                <textarea
                  rows={3}
                  value={inviteInput}
                  onChange={(event) => setInviteInput(event.target.value)}
                />
              </label>
              <button onClick={() => void joinInvite(inviteInput)}>Answer the invite</button>
              {net.code && net.phase === 'replying' ? (
                <CodeBox label="Send them this reply code" code={net.code} />
              ) : null}
            </section>
          </>
        )}

        {net.error ? <p style={{ color: 'var(--damage)' }}>{net.error}</p> : null}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

/**
 * A code to hand over. Long — an SDP offer with its ICE candidates runs to a
 * couple of kilobytes — so it is shown in a read-only box with a copy button
 * rather than asked to be read out.
 */
function CodeBox({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <label className="code-field">
      {label}
      <textarea readOnly rows={3} value={code} onFocus={(event) => event.target.select()} />
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </label>
  )
}
