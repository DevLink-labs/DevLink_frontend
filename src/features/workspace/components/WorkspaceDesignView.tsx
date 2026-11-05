import { Icon } from "@/components/ui";
import "../styles/workspace-utilities.css";

const previews = [
  { href: "/team-observatory", title: "3D 팀 스페이스 2", label: "TEAM OBSERVATORY", description: "팀의 구성과 연결을 살펴보는 3D 공간입니다.", className: "design-art-observatory", icon: "team" as const },
  { href: "/team-network", title: "3D 팀 스페이스 3", label: "TEAM NETWORK", description: "Agent 사이의 연결을 표현한 3D 공간입니다.", className: "design-art-network", icon: "agent" as const },
  { href: "/team-preview", title: "팀 디자인 미리보기", label: "DESIGN COLLECTION", description: "팀 화면의 다양한 디자인 시안을 둘러보세요.", className: "design-art-collection", icon: "grid" as const },
];

export default function WorkspaceDesignView() {
  return <div className="workspace-design"><div className="workspace-view-heading"><p className="overview-eyebrow">DESIGN COLLECTION</p><h1>디자인용 페이지</h1><p>기존 팀 스페이스와 디자인 미리보기를 한곳에 모았습니다.</p></div><div className="workspace-design-grid">{previews.map((preview) => <a key={preview.href} href={preview.href} className="workspace-design-card"><div className={`design-card-art ${preview.className}`} aria-hidden="true"><Icon name={preview.icon} /></div><div className="design-card-copy"><span>{preview.label}</span><h2>{preview.title}</h2><p>{preview.description}</p></div><span className="design-card-link">미리보기 열기<Icon name="arrow" size={16} /></span></a>)}</div><p className="workspace-utility-note"><Icon name="eye" size={17} />디자인용 미리보기에는 예시 데이터가 표시됩니다.</p></div>;
}
