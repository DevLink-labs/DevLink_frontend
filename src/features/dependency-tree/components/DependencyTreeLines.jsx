/**
 * 방사형 트리의 연결선. 부모 카드 중심에서 자식 카드 중심까지 직선으로 잇고, 카드가 선 끝을 덮는다.
 * 좌표는 CSS `d` 속성으로도 넣어 카드가 자리를 옮길 때 선도 같은 전환으로 따라가게 한다(속성 d는 CSS d를 지원하지 않는 브라우저용 대비).
 * @param {{ links: Array<{ key: string, x1: number, y1: number, x2: number, y2: number, http?: boolean, highlight?: boolean, dim?: boolean }>, width: number, height: number }} props
 */
export default function DependencyTreeLines({ links, width, height }) {
  return (
    <svg className="dependency-lines" width={width} height={height} aria-hidden="true">
      {links.map(({ key, x1, y1, x2, y2, http, highlight, dim }) => {
        const d = `M ${x1} ${y1} L ${x2} ${y2}`;
        return (
          <path key={key} d={d} style={{ d: `path("${d}")` }}
            className={"dependency-line" + (http ? " dependency-http" : "") + (highlight ? " dependency-highlight" : "") + (dim ? " dependency-dim" : "")} />
        );
      })}
    </svg>
  );
}
