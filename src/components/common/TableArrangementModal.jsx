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

function isServing(table) {
  return String(table?.trangThai || '').toUpperCase() === 'DANG_SU_DUNG';
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
    description: 'Chọn bàn trống hoặc bàn đang phục vụ cùng khu vực. Hai bàn đang có đơn sẽ được tính chung một bill.',
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
  const sourceGrouped = isGrouped(sourceTable);
  const sourceGroupId = sourceTable?.maNhomBan;
  const groupMembers = useMemo(() => {
    if (!sourceGrouped || !sourceGroupId) return sourceTable ? [sourceTable] : [];
    return tables
      .filter((table) => String(table?.maNhomBan ?? '') === String(sourceGroupId))
      .sort((a, b) => tableName(a).localeCompare(tableName(b), 'vi'));
  }, [tables, sourceTable, sourceGrouped, sourceGroupId]);
  const groupPrimary = groupMembers.find((table) => String(tableId(table)) === String(sourceTable?.maBanChinh)) || sourceTable;
  const extendingGroup = mode === 'merge' && sourceGrouped;

  useEffect(() => {
    if (!open) return;
    setTargetId('');
    setSelectedIds([]);
  }, [open, mode, sourceTable]);

  const candidates = useMemo(() => {
    const sourceId = tableId(sourceTable);
    const sourceArea = tableArea(groupPrimary || sourceTable);
    const sourceIsServing = groupMembers.some(isServing);
    return tables
      .filter((table) => tableId(table) !== sourceId)
      // Không cho chọn lại bàn đang ở trong nhóm hiện tại và cũng không cho
      // gộp trực tiếp với một nhóm bàn khác. Backend chỉ nhận bàn độc lập.
      .filter((table) => !isGrouped(table))
      .filter((table) => {
        if (mode !== 'merge') return isEmpty(table);
        // Backend chỉ cho ghép hai bàn đang có đơn khi bàn chính cũng đang phục vụ.
        // Bàn đang chờ thanh toán không được ghép thêm.
        return isEmpty(table) || (sourceIsServing && isServing(table));
      })
      .filter((table) => mode !== 'merge' || tableArea(table) === sourceArea)
      .sort((a, b) => tableName(a).localeCompare(tableName(b), 'vi'));
  }, [tables, sourceTable, mode, groupMembers, groupPrimary]);

  const dialogTitle = extendingGroup ? 'Thêm bàn vào nhóm' : meta.title;
  const dialogDescription = extendingGroup
    ? 'Chọn bàn trống hoặc bàn đang phục vụ cùng khu vực để thêm vào nhóm hiện tại. Bill chung và bàn chính được giữ nguyên.'
    : meta.description;
  const confirmText = extendingGroup ? 'Xác nhận thêm bàn' : meta.confirmText;

  function holdFor(table) {
    return reservationHolds?.get?.(String(tableId(table))) || null;
  }

  if (!open || !sourceTable) return null;

  function close() {
    if (!loading) onClose?.();
  }

  function toggleTable(id) {
    const table = tables.find((item) => String(tableId(item)) === String(id));
    // Lịch đặt chỉ khóa bàn đang trống. Bàn đang phục vụ vẫn có thể được ghép
    // để thanh toán chung theo nghiệp vụ mới.
    if (table && isEmpty(table) && reservationHolds?.has?.(String(id))) return;
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
              <h3>{dialogTitle}</h3>
              <p>{dialogDescription}</p>
            </div>
          </div>
          <button type="button" className="table-arrangement-close" onClick={close} disabled={loading} aria-label="Đóng">
            <X size={19} />
          </button>
        </header>

        <div className="table-arrangement-source">
          <span><Table2 size={18} /></span>
          <div>
            <small>{mode === 'merge' ? (extendingGroup ? 'Nhóm hiện tại' : 'Bàn chính') : mode === 'transfer' ? 'Bàn nguồn' : 'Nhóm đang chọn'}</small>
            <strong>{extendingGroup ? groupMembers.map(tableName).join(' + ') : tableName(sourceTable)}</strong>
            <p>{tableArea(groupPrimary || sourceTable)}{extendingGroup ? ` · Bàn chính: ${tableName(groupPrimary)}` : ''}</p>
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
              <span>{extendingGroup ? 'Chọn bàn thêm vào nhóm' : 'Chọn bàn ghép'}</span>
              <small>{selectedIds.length} bàn đã chọn</small>
            </div>
            <div className="table-arrangement-option-list">
              {candidates.map((table) => {
                const id = tableId(table);
                const checked = selectedIds.includes(id);
                const hold = holdFor(table);
                const unavailable = Boolean(hold && isEmpty(table));
                const serving = isServing(table);
                return (
                  <label key={id} className={`${checked ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}`.trim()}>
                    <input type="checkbox" checked={checked} disabled={unavailable} onChange={() => toggleTable(id)} />
                    <span><Table2 size={17} /></span>
                    <div>
                      <strong>{tableName(table)}</strong>
                      <small>
                        {unavailable
                          ? `Đã đặt lúc ${reservationHoldTime(hold)} · Không thể ghép`
                          : serving
                            ? `${tableArea(table)} · Đang phục vụ · Tính chung bill`
                            : `${tableArea(table)} · Bàn trống`}
                      </small>
                    </div>
                  </label>
                );
              })}
              {!candidates.length ? <div className="table-arrangement-empty">{extendingGroup ? 'Không có bàn độc lập phù hợp để thêm vào nhóm.' : 'Không có bàn phù hợp cùng khu vực để ghép.'}</div> : null}
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
            <Icon size={17} />{loading ? 'Đang xử lý...' : confirmText}
          </button>
        </footer>
      </form>
    </div>
  );
}
