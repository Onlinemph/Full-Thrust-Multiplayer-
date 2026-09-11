import { useState } from 'react'

import { acceptReply, hangUp, hostInvite, joinInvite, useNet } from './net'
import { currentGame, currentMatchSide, setMatchSide } from './store'

/**
 * Linking two browsers for a remote game.
 *
 * No server and no account: the host makes an invite code, the guest answers
 * with a reply code, and the two codes travel over whatever channel the players
 * already share — a chat window, a phone call, a scrap of paper. See `net.ts`
 * for why that is enough.
 */
export function OnlinePanel({ onClose }: { onClose: () => void }) {
  const net = useNet()
  const game = currentGame()
  const [inviteInput, setInviteInput] = useState('')
  const [replyInput, setReplyInput] = useState('')
  const side = currentMatchSide()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Remote play</h2>

        {net.phase === 'connected' ? (
          <>
            <p>Linked. Every action now travels to the other console as it happens.</p>
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
              <h3>Invite someone</h3>
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
              <h3>Join a game</h3>
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
