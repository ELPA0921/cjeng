type Identity = { id: string; year?: string; orderNo: string; orderDate: string }

export function sharedProjectIdMap(local: Identity[], shared: Identity[]): Map<string, string> {
  const key = (order: Identity) => `${order.year || order.orderDate.slice(0,4) || order.orderNo.slice(0,4)}/${order.orderNo.trim()}`
  const targets = new Map(shared.map(order => [key(order), order.id]))
  return new Map(local.flatMap(order => {
    const id = targets.get(key(order))
    return id && id !== order.id ? [[order.id, id] as [string,string]] : []
  }))
}

export function remapProjectReferences<T extends { projectId: string }>(rows: T[], ids: Map<string, string>): T[] {
  return rows.map(row => ids.has(row.projectId) ? { ...row, projectId: ids.get(row.projectId)! } : row)
}
