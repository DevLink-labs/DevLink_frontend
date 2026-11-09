import "../styles/dependencyTree.css";

/**
 * 트리 화면의 고정 레이아웃. 상단 한 줄 툴바(제목·선택 컨트롤·범례·이동 링크) 아래에
 * 팀원 선택 줄(toolbar), 그래프(남은 높이 전부), 상세 패널 순으로 쌓인다.
 */
export default function DependencyTreeFrame({ title, description, links, controls, toolbar, panel, children }) {
  return (
    <main className="dependency-page">
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
          {links && <nav className="dependency-navigation" aria-label="코드 의존성 화면">{links}</nav>}
        </div>
      </header>
      <div className="dependency-body">
        {toolbar}
        {children}
        {panel && <aside className="dependency-panel" aria-label="상세 정보">{panel}</aside>}
      </div>
    </main>
  );
}
