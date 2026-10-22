import { useEffect, useState, type CSSProperties } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import { itemDefinition } from '../application/items.ts';
import { formatNumber } from '../presentation/formatNumber.ts';
import { OreIcon } from './InventoryIcons.tsx';
import { OrePickupQueue, type OrePickup } from './OrePickupQueue.ts';

export function OrePickupFeed({ session }: { session: Pick<GameSession, 'onOreCollected'> }) {
  const [rows, setRows] = useState<readonly OrePickup[]>([]);
  useEffect(() => {
    const queue = new OrePickupQueue();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setRows([]);
    const schedule = () => {
      clearTimeout(timer);
      const next = queue.nextExpiry();
      if (next === null) return;
      timer = setTimeout(() => { setRows(queue.advance(performance.now())); schedule(); }, Math.max(0, next - performance.now()));
    };
    const unsubscribe = session.onOreCollected(batch => {
      setRows(queue.collect(batch, performance.now()));
      schedule();
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [session]);
  return <div className="ore-pickup-feed" aria-live="polite" aria-atomic="false" aria-label="新获得的矿石">
    {rows.map(row => {
      const item = itemDefinition(row.itemId);
      return <div className="ore-pickup" key={`${row.id}:${row.revision}`} data-item-id={row.itemId} style={{ '--pickup-lifetime': '2200ms' } as CSSProperties}>
        <OreIcon color={item.color} /><span>{item.name}</span><strong>+{formatNumber(row.count)}</strong>
      </div>;
    })}
  </div>;
}
