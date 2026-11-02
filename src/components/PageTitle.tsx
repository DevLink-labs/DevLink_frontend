export default function PageTitle({ title }: { title: string }) {
  const hostname = window.location.hostname
  const isLocalHost = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || /^127(?:\.\d{1,3}){3}$/.test(hostname)
    || hostname === '::1'
    || hostname === '[::1]'
  const prefix = import.meta.env.DEV && isLocalHost ? 'Local' : 'DevLink'

  return <title>{`${prefix} - ${title}`}</title>
}
