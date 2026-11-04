export type DesignPreviewView = 'gallery' | 'studio' | 'rose' | 'slate' | 'blanc' | 'mauve' | 'cobalt' | 'forest'

export const designs: { id: DesignPreviewView; name: string; caption: string; colors: string[] }[] = [
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

