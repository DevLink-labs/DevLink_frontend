import { Icon } from '../../../components/ui'

export default function StatCard({ label, value, caption, icon, online = false }: { label: string; value: string | number; caption: string; icon: 'team' | 'agent' | 'shield'; online?: boolean }) {
  return <div className="stat-card"><div><span className="stat-label">{label}</span><strong className="stat-value">{value}<span>개</span></strong><p>{caption}</p></div><span className={`stat-icon ${online ? 'stat-icon-green' : ''}`}><Icon name={icon} size={24} /></span></div>
}

