import { useTranslation } from "@/lib/i18n";
import { Icon } from '../../../components/ui'

export default function StatCard({ label, value, caption, icon, online = false }: { label: string; value: string | number; caption: string; icon: 'team' | 'agent' | 'shield'; online?: boolean }) {
  const { t } = useTranslation();
  return <div className="stat-card"><div><span className="stat-label">{label}</span><strong className="stat-value">{value}<span>{t("개")}</span></strong><p>{caption}</p></div><span className={`stat-icon ${online ? 'stat-icon-green' : ''}`}><Icon name={icon} size={24} /></span></div>
}

