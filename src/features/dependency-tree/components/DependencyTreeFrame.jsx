import "../styles/dependencyTree.css";

/**
 * 트리 화면 상단에 제목·선택 컨트롤·범례·보기 전환 버튼 배치
 * 아래에 팀원 선택 줄, 그래프, 상세 패널 배치
 */
export default function DependencyTreeFrame({ title, description, modeAction, controls, toolbar, panel, children }) {
  return (
    <section className="dependency-page" aria-label={title}>
      <header className="dependency-topbar">
        <div className="dependency-brand">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {controls && <div className="dependency-controls" role="group" aria-label="트리 선택">{controls}</div>}
        <div className="dependency-topbar-end">
          <div className="dependency-legend" aria-label="그래프 범례">
            <span className="dependency-pill dependency-pill--working">● 작업 중</span>
            <span className="dependency-pill dependency-pill--schema">스키마 변경</span>
            <span className="dependency-legend-line">FE → BE API 연결</span>
          </div>
          {modeAction}
        </div>
      </header>
      <div className="dependency-body">
        {toolbar}
        {children}
        {panel && <aside className="dependency-panel" aria-label="상세 정보">{panel}</aside>}
      </div>
    </section>
  );
}
