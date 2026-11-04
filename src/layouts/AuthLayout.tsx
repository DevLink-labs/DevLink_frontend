import type { ReactNode } from 'react'
import { Icon } from '../components/ui'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="/" aria-label="DevLink 홈">
          <span className="brand-symbol">
            D<span />
          </span>
          <span>
            DevLink<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="auth-story-content">
          <span className="story-kicker">
            <span className="live-dot" /> YOUR TEAM, CONNECTED
          </span>
          <h1>
            함께 만드는 개발,
            <br />
            <span>연결에서 시작하세요.</span>
          </h1>
          <p className="story-description">
            팀을 만들고 동료를 초대하세요.
            <br />
            각자의 Agent를 한곳에서 관리할 수 있습니다.
          </p>
          <div className="story-network" aria-hidden="true">
            <div className="network-line network-line-one" />
            <div className="network-line network-line-two" />
            <div className="network-card network-team">
              <span className="network-card-icon">
                <Icon name="team" size={24} />
              </span>
              <div>
                <strong>하나의 팀</strong>
                <span>공유하는 개발 공간</span>
              </div>
              <span className="network-check">
                <Icon name="check" size={13} />
              </span>
            </div>
            <div className="network-card network-agent-one">
              <span className="network-card-icon">
                <Icon name="agent" />
              </span>
              <div>
                <strong>나의 Agent</strong>
                <span>역할과 프로젝트 등록</span>
              </div>
            </div>
            <div className="network-card network-agent-two">
              <span className="network-card-icon">
                <Icon name="agent" />
              </span>
              <div>
                <strong>팀원의 Agent</strong>
                <span>같은 팀에서 함께 확인</span>
              </div>
            </div>
          </div>
          <div className="story-steps">
            <span>
              <b>01</b> 팀 만들기
            </span>
            <span>
              <b>02</b> 동료 초대
            </span>
            <span>
              <b>03</b> Agent 등록
            </span>
          </div>
        </div>
        <p className="story-footer">작은 연결이 만드는, 더 나은 협업.</p>
      </section>
      {children}
    </main>
  )
}
