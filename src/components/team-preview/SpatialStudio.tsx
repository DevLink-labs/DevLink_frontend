import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../ui'
import type { PreviewMember } from './previewData'
import './SpatialStudio.css'

interface SpatialStudioProps {
  members: PreviewMember[]
  selectedMemberId: string
  onSelectMember: (id: string) => void
  onInvite: () => void
}

const stationPositions = [
  { left: 93, top: 71 },
  { left: 251, top: 45 },
  { left: 426, top: 99 },
  { left: 428, top: 255 },
  { left: 262, top: 301 },
  { left: 93, top: 249 },
]

const memberColors: Record<string, string> = {
  sage: '#8d9e78',
  blue: '#849caf',
  peach: '#c99c82',
  lavender: '#a295b4',
  sand: '#baa67e',
  mint: '#81a79b',
}

export default function SpatialStudio({ members, selectedMemberId, onSelectMember, onInvite }: SpatialStudioProps) {
  const [flatView, setFlatView] = useState(true)
  const onlineAgents = members.flatMap((member) => member.agents).filter((agent) => agent.online).length

  return (
    <section className={`tps-studio${flatView ? ' tps-studio-flat' : ''}`} aria-label="팀 배치도">
      <div className="tps-toolbar">
        <div className="tps-space-label"><span>팀원 위치</span></div>
        <div className="tps-view-switch" role="group" aria-label="스튜디오 시점">
          <button type="button" aria-pressed={!flatView} className={!flatView ? 'tps-view-active' : ''} onClick={() => setFlatView(false)}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 7 4v8l-7 4-7-4V6l7-4Z M3 6l7 4 7-4M10 10v8" /></svg>입체</button>
          <button type="button" aria-pressed={flatView} className={flatView ? 'tps-view-active' : ''} onClick={() => setFlatView(true)}><Icon name="grid" size={13} />평면</button>
        </div>
      </div>

      <div className="tps-scene-viewport">

        <div className="tps-room-scene">
          <div className="tps-floor">
            <span className="tps-floor-outline" />

            <div className="tps-wall tps-wall-back"><span /><span /><span /></div>
            <div className="tps-wall tps-wall-side" />

            <div className="tps-team-table" aria-hidden="true">
              <span className="tps-table-edge" />
              <span className="tps-table-inlay" />

              <div className="tps-hub"><span className="tps-hub-core"><Icon name="team" size={24} /></span><span className="tps-hub-name">{members.length}명</span></div>
              <span className="tps-table-accent" />
            </div>

            {members.slice(0, 6).map((member, index) => {
              const position = stationPositions[index]
              const online = member.agents.filter((agent) => agent.online).length
              const selected = member.id === selectedMemberId
              return (
                <div key={member.id} className={`tps-station${selected ? ' tps-station-selected' : ''}`} style={{ left: position.left, top: position.top, '--tps-member-color': memberColors[member.color] ?? '#8d9e78' } as CSSProperties}>

                  <span className="tps-station-platform" />
                  <span className="tps-station-ring" />
                  <button type="button" className="tps-member" aria-pressed={selected} onClick={() => onSelectMember(member.id)} aria-label={`${member.name}, ${member.role === 'OWNER' ? '팀 소유자' : '팀원'}, Agent ${member.agents.length}개, 정보 보기`}>
                    <span className="tps-member-figure"><span className="tps-figure-body" /><span className="tps-figure-head">{member.initials}</span></span>
                    <span className="tps-agent-device" aria-hidden="true"><Icon name="agent" size={14} /><span className={online ? 'tps-device-online' : ''} /></span>
                    <span className="tps-member-label"><strong>{member.name}</strong><span><i className={online ? 'tps-label-online' : ''} />Agent {member.agents.length}<span className="tps-label-divider">·</span>{online > 0 ? `${online} 연결` : '오프라인'}</span></span>
                    <span className="tps-member-selection" aria-hidden="true"><Icon name="arrow" size={12} /></span>
                  </button>
                </div>
              )
            })}

            <div className="tps-entry" aria-hidden="true"><span /><span /><span /></div>
          </div>
        </div>

      </div>

      <div className="tps-compact-members" role="group" aria-label="스튜디오 팀원 선택">
        {members.slice(0, 6).map((member) => (
          <button key={member.id} type="button" aria-pressed={member.id === selectedMemberId} onClick={() => onSelectMember(member.id)}>
            <span style={{ background: memberColors[member.color] ?? '#8d9e78' }}>{member.initials}</span>{member.name}
          </button>
        ))}
      </div>

      <div className="tps-studio-footer">
        <div className="tps-scene-legend"><span><i />{onlineAgents} Agent 연결됨</span><span className="tps-scene-hint">팀원을 선택해 자세히 살펴보세요</span></div>
        <button type="button" className="tps-invite-button" onClick={onInvite}><Icon name="plus" size={15} />팀원 초대<Icon name="arrow" size={14} /></button>
      </div>
    </section>
  )
}
