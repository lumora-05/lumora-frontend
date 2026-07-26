export default function Badge({ children, type = 'neutral' }) { return <span className={`badge ${type}`}>{children}</span>; }
