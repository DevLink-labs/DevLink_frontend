import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from '../ui'
import PageTitle from '../PageTitle'
import TeamSpaceLink from '../TeamSpaceLink'
import './DesignPreviewNavigation.css'

export type DesignPreviewView = 'gallery' | 'studio' | 'rose' | 'slate' | 'blanc' | 'mauve' | 'cobalt' | 'forest'

const designs: { id: DesignPreviewView; name: string; caption: string; colors: string[] }[] = [
  { id: 'gallery', name: 'Glass Deck', caption: '팀 갤러리', colors: ['#edf1e3', '#c6e995'] },
  { id: 'studio', name: 'Spatial Studio', caption: '팀 스튜디오', colors: ['#dfe8d4', '#8ca86a'] },
  { id: 'rose', name: 'Rose Atelier', caption: '메인 시안 A', colors: ['#FBEFEF', '#FFE2E2', '#F5CBCB', '#C5B3D3'] },
  { id: 'slate', name: 'Slate Workspace', caption: '메인 시안 B', colors: ['#F8FAFC', '#D9EAFD', '#BCCCDC', '#9AA6B2'] },
  { id: 'blanc', name: 'Rose Blanc', caption: '메인 시안 C', colors: ['#FBEFEF', '#FFE2E2', '#F5CBCB', '#C5B3D3'] },
  { id: 'mauve', name: 'Mauve Studio', caption: '메인 시안 D', colors: ['#FAF8F6', '#EEE6EF', '#D8B5B0', '#755C7F', '#302B36'] },
  { id: 'cobalt', name: 'Cobalt Workspace', caption: '메인 시안 E', colors: ['#F5F7FC', '#E7EDFC', '#8D9BB6', '#4566D5', '#1B2942'] },
  { id: 'forest', name: 'Forest Desk', caption: '메인 시안 F', colors: ['#F6F7F3', '#ABC9B8', '#4D8772', '#253A32', '#173D35'] },
]

export function readDesignPreviewView(): DesignPreviewView {
  const value = new URLSearchParams(window.location.search).get('view')
  return designs.find((design) => design.id === value)?.id ?? 'gallery'
}

export default function DesignPreviewNavigation({ view, onChange }: { view: DesignPreviewView; onChange: (view: DesignPreviewView) => void }) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = Math.max(0, designs.findIndex((design) => design.id === view))
  const selectedDesign = designs[selectedIndex]

  useEffect(() => {
    tabs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }, [selectedIndex])

  function changeAdjacentDesign(direction: number) {
    onChange(designs[(selectedIndex + direction + designs.length) % designs.length].id)
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % designs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index + designs.length - 1) % designs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = designs.length - 1
    else return
    event.preventDefault()
    onChange(designs[nextIndex].id)
    tabs.current[nextIndex]?.focus()
  }

  return <header className="dpn-toolbar">
    <PageTitle title={`팀 디자인 미리보기 · ${selectedDesign.name}`} />
    <div className="dpn-intro"><span className="dpn-mark"><Icon name="eye" size={19} /></span><div><strong>디자인 미리보기</strong><span>DevLink design collection</span></div></div>
    <div className="dpn-controls">
      <select className="dpn-select" aria-label="디자인 시안 바로 선택" value={view} onChange={(event) => {
        const design = designs.find((item) => item.id === event.target.value)
        if (design) onChange(design.id)
      }}>{designs.map((design) => <option key={design.id} value={design.id}>{design.caption} · {design.name}</option>)}</select>
      <div className="dpn-stepper" role="group" aria-label="시안 순서대로 보기"><button type="button" onClick={() => changeAdjacentDesign(-1)} aria-label="이전 디자인 시안"><Icon name="chevron" size={14} /></button><span>{String(selectedIndex + 1).padStart(2, '0')}<i>/</i>{String(designs.length).padStart(2, '0')}</span><button type="button" onClick={() => changeAdjacentDesign(1)} aria-label="다음 디자인 시안"><Icon name="chevron" size={14} /></button></div>
    </div>
    <nav className="dpn-tabs" role="tablist" aria-label="디자인 시안 선택">
      {designs.map((design, index) => <button key={design.id} ref={(element) => { tabs.current[index] = element }} type="button" role="tab" id={`design-tab-${design.id}`} aria-selected={view === design.id} aria-controls="design-preview-panel" tabIndex={view === design.id ? 0 : -1} className={`dpn-tab dpn-tab-${design.id} ${view === design.id ? 'is-active' : ''}`} onClick={() => onChange(design.id)} onKeyDown={(event) => navigateTabs(event, index)}>
        <span className="dpn-swatches" aria-hidden="true">{design.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
        <span className="dpn-tab-copy"><small>{design.caption}</small><strong>{design.name}</strong></span>
        {(design.id === 'mauve' || design.id === 'cobalt' || design.id === 'forest') && <span className="dpn-new">NEW</span>}
      </button>)}
    </nav>
    <div className="dpn-actions"><TeamSpaceLink /><TeamSpaceLink edition={2} /><TeamSpaceLink edition={3} /><a className="dpn-back" href="/" aria-label="워크스페이스로 돌아가기"><span>워크스페이스</span><Icon name="logout" size={17} /></a></div>
  </header>
}
