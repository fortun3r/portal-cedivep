/** Text logo until the lab sends the official one (DISENO §3). */
export function Brand({ href }: { href?: string }) {
  const inner = <><span className="marca-nombre">CEDIVEP</span><span className="marca-srl">S.R.L.</span></>
  return href ? <a className="marca" href={href}>{inner}</a> : <div className="marca">{inner}</div>
}
