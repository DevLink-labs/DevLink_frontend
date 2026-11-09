/**
 * 방사형 트리의 연결선. 부모 카드 중심에서 자식 카드 중심까지 직선으로 잇고, 카드가 선 끝을 덮는다.
 * @param {{ links: Array<{ key: string, x1: number, y1: number, x2: number, y2: number, http?: boolean, highlight?: boolean, dim?: boolean }>, width: number, height: number }} props
 */
export default function DependencyTreeLines({ links, width, height }) {
  return (
    <svg className="dependency-lines" width={width} height={height} aria-hidden="true">
      {links.map(({ key, x1, y1, x2, y2, http, highlight, dim }) => (
        <line key={key} x1={x1} y1={y1} x2={x2} y2={y2}
          className={"dependency-line" + (http ? " dependency-http" : "") + (highlight ? " dependency-highlight" : "") + (dim ? " dependency-dim" : "")} />
      ))}
    </svg>
  );
}
