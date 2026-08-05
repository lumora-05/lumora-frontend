import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Link2, Table2, Unlink2, X } from 'lucide-react';
import { reservationHoldTime } from '../../utils/reservationHolds';

function tableId(table) {
  return table?.maBan ?? table?.id;
}

function tableName(table) {
  return table?.tenBan || `Bàn ${tableId(table)}`;
}

function tableArea(table) {
  return table?.khuVuc?.tenKhuVuc
    || table?.tenKhuVuc
    || (typeof table?.khuVuc === 'string' ? table.khuVuc : '')
    || table?.tang
    || 'Khu vực chung';
}

function isGrouped(table) {
  return Boolean(table?.maNhomBan || table?.maBanChinh || table?.dangGhepBan);
}

function isEmpty(table) {
  return String(table?.trangThai || 'TRONG').toUpperCase() === 'TRONG';
}

const MODE_META = {
  transfer: {
    title: 'Chuyển bàn',
    description: 'Chuyển toàn bộ đơn đang phục vụ sang một bàn trống khác.',
    confirmText: 'Xác nhận chuyển',
    Icon: ArrowRightLeft,
  },
  merge: {
    title: 'Ghép bàn',
    description: 'Chọn các bàn trống cùng khu vực để dùng chung một đơn với bàn chính.',
    confirmText: 'Xác nhận ghép',
    Icon: Link2,
  },
  unmerge: {
    title: 'Tách nhóm bàn',
    description: 'Tách các bàn khỏi nhóm hiện tại. Nhóm chỉ có thể tách khi không còn đơn đang mở.',
    confirmText: 'Xác nhận tách',
    Icon: Unlink2,
  },
};

export default function TableArrangementModal({
  open,
  mode = 'transfer',
  sourceTable,
  tables = [],
  loading = false,
  reservationHolds = new Map(),
  onClose,
  onSubmit,
}) {
  const [targetId, setTargetId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const meta = MODE_META[mode] || MODE_META.transfer;
  const Icon = meta.Icon;

  useEffect(() => {
    if (!open) return;
    setTargetId('');
    setSelectedIds([]);
  }, [open, mode, sourceTable]);

  const candidates = useMemo(() => {
    const sourceId = tableId(sourceTable);
    const sourceArea = tableArea(sourceTable);
    return tables
      .filter((table) => tableId(table) !== sourceId)
      .filter((table) => !isGrouped(table))
      .filter(isEmpty)
      .filter((table) => mode !== 'merge' || tableArea(table) === sourceArea)
      .sort((a, b) => tableName(a).localeCompare(tableName(b), 'vi'));
  }, [tables, sourceTable, mode]);


  function holdFor(table) {
    return reservationHolds?.get?.(String(tableId(table))) || null;
  }

  if (!open || !sourceTable) return null;

  function close() {
    if (!loading) onClose?.();
  }

  function toggleTable(id) {
    if (reservationHolds?.has?.(String(id))) return;
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  function submit(event) {
    event.preventDefault();
    if (mode === 'transfer') {
      if (!targetId) return;
      onSubmit?.(Number(targetId));
      return;
    }
    if (mode === 'merge') {
      if (!selectedIds.length) return;
      onSubmit?.(selectedIds.map(Number));
      return;
    }
    onSubmit?.();
  }

  const canSubmit = mode === 'unmerge'
    || (mode === 'transfer' && Boolean(targetId))
    || (mode === 'merge' && selectedIds.length > 0);

  return (
    <div className="table-arrangement-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="table-arrangement-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <div className="table-arrangement-heading">
            <span><Icon size={21} /></span>
            <div>
              <h3>{meta.title}</h3>
              <p>{meta.description}</p>
            </div>
          </div>
          <button type="button" className="table-arrangement-close" onClick={close} disabled={loading} aria-label="Đóng">
            <X size={19} />
          </button>
        </header>

        <div className="table-arrangement-source">
          <span><Table2 size={18} /></span>
          <div>
            <small>{mode === 'merge' ? 'Bàn chính' : mode === 'transfer' ? 'Bàn nguồn' : 'Nhóm đang chọn'}</small>
            <strong>{tableName(sourceTable)}</strong>
            <p>{tableArea(sourceTable)}</p>
          </div>
        </div>

        {mode === 'transfer' ? (
          <label className="table-arrangement-select">
            <span>Bàn đích</span>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
              <option value="">Chọn bàn trống</option>
              {candidates.map((table) => {
                const hold = holdFor(table);
                return (
                  <option key={tableId(table)} value={tableId(table)} disabled={Boolean(hold)}>
                    {tableName(table)} · {tableArea(table)}{hold ? ` · Đã đặt ${reservationHoldTime(hold)}` : ''}
                  </option>
                );
              })}
            </select>
            {!candidates.length ? <small>Không có bàn trống độc lập để chuyển đến.</small> : candidates.some(holdFor) ? <small className="reservation-hold-note">Bàn có lịch đặt sắp tới được khóa để tránh trùng giờ.</small> : null}
          </label>
        ) : null}

        {mode === 'merge' ? (
          <div className="table-arrangement-options">
            <div className="table-arrangement-options-head">
              <span>Chọn bàn ghép</span>
              <small>{selectedIds.length} bàn đã chọn</small>
            </div>
            <div className="table-arrangement-option-list">
              {candidates.map((table) => {
                const id = tableId(table);
                const checked = selectedIds.includes(id);
                const hold = holdFor(table);
                return (
                  <label key={id} className={`${checked ? 'selected' : ''} ${hold ? 'unavailable' : ''}`.trim()}>
                    <input type="checkbox" checked={checked} disabled={Boolean(hold)} onChange={() => toggleTable(id)} />
                    <span><Table2 size={17} /></span>
                    <div><strong>{tableName(table)}</strong><small>{hold ? `Đã đặt lúc ${reservationHoldTime(hold)} · Không thể ghép` : tableArea(table)}</small></div>
                  </label>
                );
              })}
              {!candidates.length ? <div className="table-arrangement-empty">Không có bàn trống cùng khu vực để ghép.</div> : null}
            </div>
          </div>
        ) : null}

        {mode === 'unmerge' ? (
          <div className="table-arrangement-warning">
            Sau khi tách, mỗi bàn trở lại hoạt động độc lập. Hệ thống sẽ từ chối nếu nhóm vẫn còn đơn đang phục vụ.
          </div>
        ) : null}

        <footer>
          <button type="button" onClick={close} disabled={loading}>Hủy bỏ</button>
          <button type="submit" className="primary" disabled={loading || !canSubmit}>
            <Icon size={17} />{loading ? 'Đang xử lý...' : meta.confirmText}
          </button>
        </footer>
      </form>
    </div>
  );
}
